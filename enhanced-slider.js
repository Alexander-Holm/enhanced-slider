export { EnhancedSlider }

const componentName = "enhanced-slider"

class EnhancedSlider extends HTMLElement{
    static formAssociated = true
    constructor(){
        super()
        this.connected = false
        // internals is needed to set the value that is submitted with a form
        this.internals = this.attachInternals()
        this.attachShadow({mode: "open"})
        
        const { slider, inputBox, ticks, buttons, labels } = this.children
        this.#configureHTML(slider, inputBox, ticks, buttons, labels)
        this.children.css.innerHTML = css 
    }

    children = {
        slider: document.createElement("input"), 
        inputBox: document.createElement("input"),
        buttons: { 
            decrement: document.createElement("button"), 
            increment: document.createElement("button") 
        },
        // This assignment creates a <div> with the properties min and max,
        // that each holds a <span>, that can be accessed with this.children.labels.min
        // This does not add them as children in the HTML, that has to be done later!
        labels: Object.assign(
            document.createElement("div"),
            {
                min: document.createElement("span"), 
                max: document.createElement("span")
            }
        ),
        ticks: document.createElement("datalist"),
        css: document.createElement("style")
    }

    // These functions ending with callback are custom element lifecycle callbacks.
    // They are not called from in here and needs to have these exact names.
    connectedCallback(){
        const { slider, inputBox, buttons, labels, ticks, css } = this.children
        this.shadowRoot.append(buttons.decrement, slider, buttons.increment, inputBox, labels, ticks, css)
        this.#initializeNumberProperties()
        this.#initializeBooleanProperties()
        // ticks should be set after min, max, and step
        this.ticks = this.getAttribute("ticks") ?? "labels"
        this.connected = true
    }
    disconnectedCallback(){ this.connected = false }
    formResetCallback(){ this.value = this.defaultValue }
    static numberAttributes = [ "value", "min", "max", "step" ]
    static booleanAttributes = [ "disabled", "hide-labels" ]
    static observedAttributes = [ ...EnhancedSlider.numberAttributes, ...EnhancedSlider.booleanAttributes, "ticks" ]
    attributeChangedCallback(name, oldValue, newValue){
        // attributeChangedCallback() will be called before connectedCallback(),
        // but the property setters requires HTML elements to exist.
        // This function will return when it is run with the initial attributes from HTML.
        // connectedCallback() will then read the attributes and assign them to properties.
        if(!this.connected) return
        if(newValue === oldValue) return
        this[name] = newValue
    }   

    // No default values on the private fields!
    // Everything needs to go through the setters.    
    #value 
    get value(){ return this.#value}
    set value(newValue){
        const { slider, inputBox } = this.children

        if(this.#isNotNumber(newValue)){
            inputBox.value = this.#value
            return
        }

        // Let slider handle validation of min, max, step
        slider.value = Number(newValue).toFixed(this.decimalPrecision)
        // Some browsers strip trailing decimals from slider.value, add them again for consistency.
        this.#value = inputBox.value = Number(slider.value).toFixed(this.decimalPrecision)
        this.internals.setFormValue(this.#value)

        this.#handleButtonState()
        return
    }

    #min
    get min(){ return this.#min }
    set min(newValue){
        if(this.#isNotNumber(newValue) || newValue === this.#min) return
        const { slider, labels } = this.children
        slider.min = newValue
        this.#min = labels.min.innerHTML = slider.min
        this.setAttribute("min", this.#min)
        // Max needs to be recalculated so that all steps fit between min and max
        // Value will be recalculated by max setter if needed.
        this.max = this.#max
        const { min, max, value } = this.#getPropertiesAsNumbers()
        if(min > max) this.max = this.#min
        this.#updateDecimalPrecision()
        this.#handleButtonState()
        this.ticks = this.#ticks
        if(min > value) this.value = this.#min
    } 

    #max
    get max(){ return this.#max }
    set max(newValue){
        // Don't return if newValue === #max
        // It should be possible to rerun the validation
        // by calling this setter with the same value.
        if(this.#isNotNumber(newValue)) return
        const { slider, labels } = this.children
        // Change max to maximum value that can actually be set.
        // The maximum value is determined by step and min (or value if no min).
        // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range
        const sliderOriginalValue = slider.value
        slider.max = newValue
        // This will be the maximum value possible with the current step and min attributes.
        slider.value = Number.MAX_VALUE
        if(slider.value !== slider.max)
            console.warn(
                `${componentName} 'max' attribute was adjusted becuase it was not possible to reach with the combination of 'min', 'max', and 'step' attributes.`,
                `\nOriginal value: ${slider.max}`,
                `\nNew value: ${slider.value}`,
                "\nSee attributes of: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range"
            )
        slider.max = slider.value
        slider.value = sliderOriginalValue
        this.#max = labels.max.innerHTML = slider.max
        this.setAttribute("max", this.#max)
        this.#updateDecimalPrecision()
        this.#handleButtonState()
        this.ticks = this.#ticks
        const { max, value } = this.#getPropertiesAsNumbers()
        if(value > max) this.value = this.#max
        // Recalculate to make sure value is a step between min and max
        else this.value = this.#value
    }

    #step
    get step(){ return this.#step }
    set step(newValue){
        if(this.#isNotNumber(newValue) || newValue === this.#step) return
        const { slider } = this.children
        slider.step = newValue
        this.#step = slider.step
        this.setAttribute("step", this.#step)
        // Max needs to be recalculated so that all steps fit between min and max
        this.max = this.#max
        this.#updateDecimalPrecision()
        this.ticks = this.#ticks
        // Recalculate to make sure value is a step between min and max
        this.value = this.#value
    }

    #hideLabels
    get hideLabels(){ return this.#hideLabels }
    // The code in attributeChangedCallback looks for a setter with the name of the attribute.
    set ["hide-labels"](attributeValue){ this.hideLabels = attributeValue }
    set hideLabels(boolean){
        // Does not disable if attribute is set with the string "false".
        // This is how <input> elements do it
        if(boolean === null || boolean === false){
            this.removeAttribute("hide-labels")
            this.#hideLabels = false
        }
        else {
            this.setAttribute("hide-labels", "")
            this.#hideLabels = true
        }
        // Labels visibility is handled in CSS and is dependent on the HTML attribute
    }

    #disabled
    get disabled(){ return this.#disabled }
    set disabled(boolean){
        // Does not disable if attribute is set with the string "false".
        // This is how <input> elements do it
        if(boolean === null || boolean === false){
            this.removeAttribute("disabled")
            this.#disabled = false
        }
        else {
            this.setAttribute("disabled", "")
            this.#disabled = true
        }
        const { slider, inputBox, buttons } = this.children
        slider.disabled = inputBox.disabled = buttons.decrement.disabled = buttons.increment.disabled = this.#disabled
        this.#handleButtonState()
    }

    #ticks
    get ticks() { return this.#ticks }
    /** @param {"labels" | "all" | "none" | null} value */
    set ticks(value){
        if(value === undefined) return
        if(value === "none" || value === null){
            // Disconnecting the <datalist> instead of removing all its <option>
            this.children.slider.removeAttribute("list")
            this.#ticks = null
            this.removeAttribute("ticks")
            return
        }
        if(value !== "labels" && value !== "all") return

        const newTicks = []
        this.children.slider.setAttribute("list", "ticks")
        if(value === "labels"){
            const min = document.createElement("option")
            min.value = this.#min
            const max = document.createElement("option")
            max.value = this.#max
            newTicks.push(min, max)
        }
        else if(value === "all"){ 
            const { min, max, step } = this.#getPropertiesAsNumbers()
            for(let tickValue = min; tickValue <= max; tickValue += step){
                const option = document.createElement("option")
                option.value = tickValue
                newTicks.push(option)
            }
        }
        this.#ticks = value
        this.setAttribute("ticks", value)
        this.children.ticks.replaceChildren(...newTicks)
    }

    #initializeNumberProperties(){
        EnhancedSlider.numberAttributes.forEach(attribute => {
            this[attribute] = this.getAttribute(attribute)
        })
        // This assigns default values if:
        // - No attribute
        // - Invalid attribute value
        // - Property has not already been set in Javascript by user
        this.min ??= 0
        this.step ??= 1
        this.max ??= 100
        const { min, max } = this.#getPropertiesAsNumbers()
        this.value ??= (min + max) / 2
        this.defaultValue = this.value
    }
    #initializeBooleanProperties(){
        EnhancedSlider.booleanAttributes.forEach(attribute => {
            // Assign true if the attribute is present,
            // otherwise keep the value if it has already been set in Javascript.
            // If none are set it defaults to false.
            this[attribute] = this.hasAttribute(attribute) || (this[attribute] === true)
        })
    }

    #getPropertiesAsNumbers(){
        const min = Number(this.#min)
        const max = Number(this.#max)
        const value = Number(this.#value)
        const step = Number(this.#step)
        return { min, max, value, step }
    }
    // isNaN() alone does not work for checking if a variable is not a number.
    // null, "", [] will be interpreted as numbers and return false!
    // See: https://stackoverflow.com/a/68821383/25594533
    // Solution from: https://stackoverflow.com/a/21070520/25594533
    #isNotNumber(unknown){
        return isNaN(unknown - parseFloat(unknown));
    }
    #countDecimals(unknown){
        const decimals = unknown?.toString().split(".")[1]
        return decimals?.length || 0
    }
    #updateDecimalPrecision(){
        const newCount = Math.max(this.#countDecimals(this.#min), this.#countDecimals(this.#max), this.#countDecimals(this.#step))
        if(newCount !== this.decimalPrecision){
            this.decimalPrecision = newCount
            // Force value to have the correct amount of decimals
            this.#value = this.#value
        }

        const { min, max } = this.#getPropertiesAsNumbers()
        const maxCharacters = Math.max(
            min.toFixed(this.decimalPrecision).length,
            max.toFixed(this.decimalPrecision).length
        )
        this.children.inputBox.style.width = `${maxCharacters + 1}ch`
    }
    #handleButtonState(){
        if(this.disabled) return
        const { value, min, max } = this.#getPropertiesAsNumbers()
        const { decrement, increment } = this.children.buttons
        // Always check both min and max as they can be the same value
        if(value <= min) decrement.disabled = true
        else if(!this.disabled) decrement.disabled = false
        if(value >= max) increment.disabled = true
        else if(!this.disabled) increment.disabled = false
    }
   
    #configureHTML(slider, inputBox, ticks, buttons, labels){
        ticks.id = "ticks"

        slider.type = "range"
        slider.part = "slider"
        slider.setAttribute("list", ticks.id)
        inputBox.type = "text"
        inputBox.inputMode = "decimal"
        inputBox.autocomplete = "off"
        inputBox.part = "input-box"
        // inputBox should not be oninput,
        // the validation might reset the input as you are typing.
        inputBox.onchange = slider.oninput = (e) => {
            this.value = e.target.value
            this.dispatchEvent(new Event("change"))
        }

        const { decrement, increment } = buttons
        decrement.part = "button decrement"
        increment.part = "button increment"
        const decrementIconSlot = document.createElement("slot")
        const incrementIconSlot = document.createElement("slot")
        decrementIconSlot.setAttribute("name", "decrement")
        incrementIconSlot.setAttribute("name", "increment")
        decrementIconSlot.innerHTML = icons.left
        incrementIconSlot.innerHTML = icons.right
        decrement.append(decrementIconSlot)
        increment.append(incrementIconSlot)
        const buttonFunction = (stepDirection) => {
            const { value, step } = this.#getPropertiesAsNumbers()
            this.value = value + (step * stepDirection)
            this.dispatchEvent(new Event("change"))
        }
        new ButtonIntervalWrapper(decrement, () => buttonFunction(-1))
        new ButtonIntervalWrapper(increment, () => buttonFunction(1))

        const { min, max } = labels
        labels.classList.add("labels")
        min.part = "label min"
        max.part = "label max"
        labels.append(min, max)        
    }
}

class ButtonIntervalWrapper{
    intervals = [150, 140, 130, 100, 80, 60, 50]
    intervalsCount = this.intervals.length
    intervalIndex = 0
    onInterval = null
    timerId = null
    button = null
    constructor(htmlButton, onInterval){
        this.button = htmlButton
        this.onInterval = onInterval
        // Have to use bind, otherwise "this" inside the function will refer to the clicked button.
        // Arrow functions also work.
        htmlButton.onpointerup = htmlButton.onpointerleave = htmlButton.onpointercancel = this.stopInterval.bind(this)
        // Could check for "Enter" on keyup but who cares
        htmlButton.onblur = htmlButton.onkeyup =this.stopInterval.bind(this)
        htmlButton.onpointerdown = (event) => {
            // If a new press happens while the timer is running it should restart.
            // This makes several fast clicks work correctly.
            if(this.timerId !== null) 
                this.stopInterval()
            this.startInterval(event)
        }
        htmlButton.onkeydown = (event) => {
            if(event.key === "Enter" && event.repeat === false){
                if(this.timerId !== null)
                    this.stopInterval()
                this.startInterval(event)
            }
        }
    }
    startInterval(event){
        if(this.button.disabled){
            this.stopInterval()
            return
        }
        this.onInterval?.call()
        let interval
        if(this.intervalIndex < this.intervalsCount)
            interval = this.intervals[this.intervalIndex++]
        else interval = this.intervals[this.intervalsCount - 1]
        // setTimeout argument needs to be an arrow function
        this.timerId = setTimeout(() => this.startInterval(event), interval)
    }
    stopInterval(){
        clearTimeout(this.timerId)
        this.timerId = null
        this.intervalIndex = 0
    }
}

// https://www.svgrepo.com/collection/humbleicons-oval-line-icons/2?search=chevron
// MIT License
const icons = {
    left: `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l-7 7 7 7"/>
        </svg>
    `,
    right: `
       <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 5l7 7-7 7"/>
        </svg>
    `,
}

const css = `
    :host {
        display: grid;
        grid-template-columns: auto 1fr auto;
        column-gap: 3px;
        min-width: 10rem;
        max-width: 24rem;
        box-sizing: content-box;
        margin-block: 10px;
        color: light-dark(black, white);
    }        
    :host([hidden]) {
        display: none;
    }
    input[type = "range"] {
        z-index: 3;
        grid-row: 1;
        grid-column: 2;
        min-width: 0;
        margin: 0;
        padding: 0;
    }
    /* Set width with Javascript */
    input[type = "text"] {
        z-index: 2;
        grid-area: 2/2;
        text-align: center;
        font-size: 0.9rem;
        padding: 2px;
        box-sizing: content-box;
        border: 1px solid light-dark(#bbb, #555);
        border-radius: 4px;
        color: inherit;
        margin: auto;
        margin-top: 6px;
    }
    .labels {
        grid-row: 2;
        grid-column: 2;
        margin-bottom: auto;
        margin-top: 2px;
        display: flex;
        justify-content: space-between;
        font-family: monospace;
        font-size: 0.8rem;
        color: gray;
        & > span {
            /* Magic number */
            width: 18px;
            display: flex;
            justify-content: center;
            user-select: none;
        }            
    }
    :host(:disabled) > .labels {
        opacity: 0.5;
        color: gray;
    }
    :host([hide-labels]) > .labels {
        display: none;
    }
    button {
        --size: 1.25em;
        font-size: 1rem;
        width: var(--size);
        height: var(--size);
        aspect-ratio: 1;
        box-sizing: content-box;
        padding: 2px;
        margin: auto;
        border: 0px;
        border-radius: 4px;
        background-color: transparent;
        color: inherit;
        display: flex;
        justify-content: center;
        align-items: center;
        grid-row: 1;
        user-select: none;
        touch-action: none;
        /* Needs the webkit specific properties! */
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        &:enabled:is(:hover, :active) { background-color: revert; }
        &:disabled { 
            opacity: 0.4; 
            color: gray; 
        }
    }
`

customElements.define(componentName, EnhancedSlider)