export { EnhancedSlider }

class EnhancedSlider extends HTMLElement{
    static formAssociated = true
    // HTML elements
     children = {
        slider: undefined, inputBox: undefined,
        buttons: { decrement: undefined, increment: undefined },
        labels: { min: undefined, max: undefined }
    }
    constructor(){
        super()
        this.connected = false
        this.internals = this.attachInternals()
        this.attachShadow({mode: "open"})
    }

    // These functions ending with callback are custom element lifecycle callbacks.
    // They are not called from in here and needs to have these exact names.
    connectedCallback(){
        this.createHTML()
        this.readAttributes()
        this.createCSS()
        this.connected = true
    }
    disconnectedCallback(){ this.connected = false }
    formResetCallback(){ this.value = this.defaultValue }
    static observedAttributes = ["disabled", "value", "min", "max", "step"]
    attributeChangedCallback(name, oldValue, newValue){
        // attributeChangedCallback() will be called before connectedCallback(),
        // but the property setters requires HTML elements to exist.
        // This function will return when it is run with the initial attributes from HTML.
        // connectedCallback() will then read the attributes and assign them to properties.
        if(!this.connected) return
        if(newValue === oldValue) return
        this[name] = newValue
    }

    #disabled
    get disabled(){ return this.#disabled }
    set disabled(unknown){
        // Does not disable if attribute is set with the string "false".
        // This is how <input> elements do it
        if(unknown === null || unknown === false){
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
        if(min > value) this.value = this.#min
    } 

    #max
    get max(){ return this.#max }
    set max(newValue){
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
        // Recalculate to make sure value is a step between min and max
        this.value = this.#value
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

   

    createHTML(){
        const slider = this.children.slider = document.createElement("input")
        slider.type = "range"
        slider.part = "slider"
        const inputBox = this.children.inputBox = document.createElement("input")
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

        const labels = document.createElement("div")
        labels.classList.add("labels")
        for(const minOrMax of ["min", "max"]){
            const label = document.createElement("div")
            const tick = document.createElement("span")
            const value = document.createElement("span")
            const elements = Object.entries({ label, tick, value })
            for (const [name, element] of elements) {
                element.classList.add(name)
                element.part = `${name} ${minOrMax}`
            }
            label.append(tick, value)
            labels.append(label)
            this.children.labels[minOrMax] = value
        }
        
        const decrement = this.children.buttons.decrement = document.createElement("button")
        const increment = this.children.buttons.increment = document.createElement("button")
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
        
        this.shadowRoot.append(decrement, slider, increment, inputBox, labels)
    }

    readAttributes(){
        this.min = this.getAttribute("min")
        this.max = this.getAttribute("max")
        this.step = this.getAttribute("step")
        this.value = this.getAttribute("value")
        this.disabled = this.hasAttribute("disabled")
        // Defaults if attributes are not valid.
        // Can't be run on the same line with: getAttribute() ?? defaultValue
        // because the attribute can be set with a value that does not pass the setter validation.
        // Below values will be null/undefined if the attribute value is invalid or not set in HTML.
        this.min ??= 0
        this.max ??= 100
        this.step ??= 1
        const { min, max } = this.#getPropertiesAsNumbers()
        this.value ??= (min + max) / 2
        this.defaultValue = this.value
    }

    createCSS(){
        const style = document.createElement("style")
        this.shadowRoot.appendChild(style)
        style.sheet.insertRule(`:host {
            display: grid;
            grid-template-columns: auto 1fr auto;
            column-gap: 3px;
            min-width: 10rem;
            max-width: 24rem;
            box-sizing: content-box;
            margin-block: 10px;
            color: light-dark(black, white);
        }`)        
        style.sheet.insertRule(`:host([hidden]) {
            display: none;
        }`)
        style.sheet.insertRule(`
            input[type = "text"]:enabled, 
            button:enabled,
            :host:enabled .labels 
            {
                color: inherit;
            }
        `)
        style.sheet.insertRule(`input[type = "range"] {
            z-index: 3;
            grid-row: 1;
            grid-column: 2;
            min-width: 0;
            margin: 0;
            padding: 0;
        }`)
        // Set width with Javascript
        style.sheet.insertRule(`input[type = "text"] {
            z-index: 2;
            text-align: center;
            font-size: 0.9rem;
            padding: 2px;
            box-sizing: content-box;
            border: 1px solid;
            border-color: light-dark(#bbb, #555);
            border-radius: 4px;
            grid-row: 2;
            grid-column: 2;
            margin-inline: auto;
            margin-top: 2px;
        }`)
        style.sheet.insertRule(`.labels {
            grid-row: 2;
            grid-column: 2;
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-inline: calc(8px + var(--labels-horizontal, 0px));
            margin-top: calc(-6px + var(--labels-vertical, 0px));
            opacity: 70%;
        }`)
        style.sheet.insertRule(`:host(:disabled) > .labels {
            color: gray;
            opacity: 0.5;
        }`)
        // width:0 makes the ticks position perfectly mirrored
        style.sheet.insertRule(`.label {
            width: 0;
            overflow: visible;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-size: 0.9rem;
            font-family: monospace;
            & > .tick {
                width: 1px;
                height: 4px;
                background-color: currentColor;
                margin-bottom: 0px;
            }
            & > .value {
                user-select: none;
                -webkit-user-select: none;
            }
        }`)
        // Needs the webkit specific properties!
        style.sheet.insertRule(`button {
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
            display: flex;
            justify-content: center;
            align-items: center;
            grid-row: 1;
            user-select: none;
            touch-action: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            &:enabled:is(:hover, :active) { background-color: revert; }
            &:disabled { opacity: 0.4; }
        }`)
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

customElements.define("enhanced-slider", EnhancedSlider)