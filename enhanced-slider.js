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
        
        const { inputBox, buttons, sliderContainer } = this.children
        // This does not insert any HTML into the document,
        // that can only happen in connectedCallback()
        this.#configureHTMLElements(inputBox, buttons, sliderContainer)
        this.#addCSS()
    }
    // These functions ending with callback are custom element lifecycle callbacks.
    // They are not called from in here and needs to have these exact names.
    connectedCallback(){
        this.#initializeProperties()
        const { sliderContainer, inputBox, buttons } = this.children
        this.shadowRoot.append(buttons.decrement, sliderContainer, buttons.increment, inputBox)
        // Has to be done after adding all elements to DOM,
        // because the function reads thumb.offsetWidth
        this.#updateSliderPosition()
        this.connected = true
    }
    disconnectedCallback(){ this.connected = false }
    formResetCallback(){ this.value = this.defaultValue }
    static observedAttributes = [ "value", "min", "max", "step", "ticks", "labels", "disabled" ]
    attributeChangedCallback(name, oldValue, newValue){
        // attributeChangedCallback() will be called before connectedCallback(),
        // but the property setters requires HTML elements to exist.
        // This function will return when it is run with the initial attributes from HTML.
        // connectedCallback() will then read the attributes and assign them to properties.
        if(!this.connected) return
        if(newValue === oldValue) return
        this[name] = newValue
    }

    children = {
        inputBox: document.createElement("input"),
        buttons: { 
            decrement: document.createElement("button"), 
            increment: document.createElement("button") 
        },
        // This creates an object with properties that contain HTML elements.
        // This does not add them as children in the HTML!
        // That has to be done later with element.append()

        // sliderContainer is a fieldset so that it can be disabled.
        // This makes it easier to style with css.
        sliderContainer: Object.assign(document.createElement("fieldset"), {
            hiddenInputRange: document.createElement("input"), 
            customSlider: Object.assign(document.createElement("div"), {
                thumb: document.createElement("span"),
                track: Object.assign(document.createElement("div"), {
                    fill: document.createElement("span")
                })
            }),
            ruler: Object.assign(document.createElement("div"), {
                    labels: document.createElement("div"),
                    ticks: document.createElement("div")
            }),
        })
    }

    // No default values on the private fields!
    // Everything needs to go through the setters.    
    #value 
    get value(){ return this.#value}
    set value(newValue){
        const { inputBox } = this.children
        
        if(this.#isNotNumber(newValue)){
            inputBox.value = this.#value
            return
        }
        
        // Let slider handle validation of min, max, step
        const { hiddenInputRange } = this.children.sliderContainer
        hiddenInputRange.value = Number(newValue).toFixed(this.decimalPrecision)
        // Some browsers strip trailing decimals from slider.value, add them again for consistency.
        this.#value = inputBox.value = Number(hiddenInputRange.value).toFixed(this.decimalPrecision)
        this.internals.setFormValue(this.#value)
        
        this.#updateSliderPosition()
        this.#handleButtonState()
        return
    }

    #min
    get min(){ return this.#min }
    set min(newValue){
        if(this.#isNotNumber(newValue) || newValue === this.#min) return
        const { hiddenInputRange } = this.children.sliderContainer
        hiddenInputRange.min = newValue
        this.#min = hiddenInputRange.min
        this.setAttribute("min", this.#min)
        // Max needs to be recalculated so that all steps fit between min and max
        // Value will be recalculated by max setter if needed.
        this.max = this.#max
        const { min, max, value } = this.#getPropertiesAsNumbers()
        if(min > max) this.max = this.#min
        this.#updateDecimalPrecision()
        this.#handleButtonState()
        this.ticks = this.#ticks
        this.labels = this.#labels
        if(min > value) this.value = this.#min
    } 

    #max
    get max(){ return this.#max }
    set max(newValue){
        // Don't return if newValue === #max
        // It should be possible to rerun the validation
        // by calling this setter with the same value.
        if(this.#isNotNumber(newValue)) return
        const { hiddenInputRange } = this.children.sliderContainer
        // Change max to maximum value that can actually be set.
        // The maximum value is determined by step and min (or value if no min).
        // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range
        const sliderOriginalValue = hiddenInputRange.value
        hiddenInputRange.max = newValue
        // This will be the maximum value possible with the current step and min attributes.
        hiddenInputRange.value = Number.MAX_VALUE
        if(hiddenInputRange.value !== hiddenInputRange.max)
            console.warn(
                `${componentName} 'max' attribute was adjusted becuase it was not possible to reach with the combination of 'min', 'max', and 'step' attributes.`,
                `\nOriginal value: ${hiddenInputRange.max}`,
                `\nNew value: ${hiddenInputRange.value}`,
                "\nSee attributes of: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range"
            )
        hiddenInputRange.max = hiddenInputRange.value
        hiddenInputRange.value = sliderOriginalValue
        this.#max = hiddenInputRange.max
        this.setAttribute("max", this.#max)
        this.#updateDecimalPrecision()
        this.#handleButtonState()
        this.ticks = this.#ticks
        this.labels = this.#labels
        const { max, value } = this.#getPropertiesAsNumbers()
        if(value > max) this.value = this.#max
        // Recalculate to make sure value is a step between min and max
        else this.value = this.#value
    }

    #step
    get step(){ return this.#step }
    set step(newValue){
        if(this.#isNotNumber(newValue) || newValue === this.#step) return
        const { hiddenInputRange } = this.children.sliderContainer
        hiddenInputRange.step = newValue
        this.#step = hiddenInputRange.step
        this.setAttribute("step", this.#step)
        // Max needs to be recalculated so that all steps fit between min and max
        this.max = this.#max
        this.#updateDecimalPrecision()
        this.ticks = this.#ticks
        this.labels = this.#labels
        // Recalculate to make sure value is a step between min and max
        this.value = this.#value
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
        const { inputBox, sliderContainer } = this.children
        const { hiddenInputRange } = sliderContainer
        const { decrement, increment } = this.children.buttons
        sliderContainer.disabled = hiddenInputRange.disabled = inputBox.disabled = decrement.disabled = increment.disabled = this.#disabled
        this.#handleButtonState()
    }

    #ticks
    get ticks() { return this.#ticks }
    /** @param {"min-max" | "all" | "none" | null} value */
    set ticks(value){
        if(value === undefined) return
        // value will be null if attribute is removed with element.removeAttribute()
        if(value === "none" || value === null){
            this.#ticks = "none"
            this.setAttribute("ticks", "none")
            return
        }
        if(value === "min-max" || value === "all"){
            const { min, max, step } = this.#getPropertiesAsNumbers()
            const newTickArray = []
            for(let tick = min; tick <= max; tick += step){
                const wrapper = document.createElement("span")
                wrapper.className = "width-zero-centering"
                const tickElement = document.createElement("span")
                tickElement.className = "tick"
                tickElement.part = "tick"
                wrapper.appendChild(tickElement)
                newTickArray.push(wrapper)
            }
            this.children.sliderContainer.ruler.ticks.replaceChildren(...newTickArray)
            this.#ticks = value
            this.setAttribute("ticks", value)
            return
        }
    }

    #labels
    get labels() { return this.#labels }
    /** @param {"min-max" | "all" | "none" | null} value */
    set labels(value){
        if(value === undefined) return
        // value will be null if attribute is removed with element.removeAttribute()
        if(value === "none" || value === null){
            this.#labels = "none"
            this.setAttribute("labels", "none")
            return
        }
        if(value === "min-max" || value === "all"){
            const { min, max, step } = this.#getPropertiesAsNumbers()
            const newLabelArray = []
            for(let label = min; label <= max; label += step){
                const element = document.createElement("span")
                element.part = "label"
                element.innerHTML = label
                newLabelArray.push(element)
            }
            this.children.sliderContainer.ruler.labels.replaceChildren(...newLabelArray)
            this.#labels = value
            this.setAttribute("labels", value)
            return
        }
    }

    #initializeProperties(){
        // boolean attributes
        Array("disabled").forEach(attribute => {
            // Assign true if the attribute is present,
            // otherwise keep the value if it has already been set in Javascript.
            // If none are set it defaults to false.
            this[attribute] = this.hasAttribute(attribute) || (this[attribute] === true)
        })

        // These properties can not be set using getAttribute() ?? "defaultValue"
        // because the attribute could have a value that does not pass the setter.
        // That would leave the property as undefined.
        Array("value", "min", "max", "step").forEach(attribute => {
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
        // Used when a <form> parent is reset
        this.defaultValue = this.value
        
        // These have to be set after min, max, step are guaranteed to have values
        Array("ticks", "labels").forEach(attribute => {
            this[attribute] = this.getAttribute(attribute) ?? "min-max"
            this[attribute] ??= "min-max"
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
    #updateSliderPosition(){
        const { thumb, track } = this.children.sliderContainer.customSlider

        const { value, max, min } = this.#getPropertiesAsNumbers()
        const percentDecimal = (value - min) / (max - min)
        const percent = percentDecimal * 100
        
        track.fill.style.width = percent.toFixed(3)+"%"
        const thumbOffset = `(${thumb.offsetWidth}px * ${percentDecimal})`
        thumb.style.marginLeft = `calc(${percent.toFixed(3)}% - ${thumbOffset})`
    }
   
    #configureHTMLElements(inputBox, buttons, sliderContainer){
        const { hiddenInputRange } = sliderContainer
        hiddenInputRange.type = "range"
        hiddenInputRange.className = "hidden-overlay"
        inputBox.type = "text"
        inputBox.inputMode = "decimal"
        inputBox.autocomplete = "off"
        inputBox.size = "2"
        inputBox.part = "input-box"
        // inputBox should not be oninput,
        // the validation might reset the input as you are typing.
        inputBox.onchange = hiddenInputRange.oninput = (e) => {
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
        // https://www.svgrepo.com/collection/humbleicons-oval-line-icons/2?search=chevron
        // MIT License
        decrementIconSlot.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l-7 7 7 7"/>
            </svg> `
        incrementIconSlot.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 5l7 7-7 7"/>
            </svg> `
        decrement.append(decrementIconSlot)
        increment.append(incrementIconSlot)
        const buttonFunction = (stepDirection) => {
            const { value, step } = this.#getPropertiesAsNumbers()
            this.value = value + (step * stepDirection)
            this.dispatchEvent(new Event("change"))
        }
        new ButtonIntervalWrapper(decrement, () => buttonFunction(-1))
        new ButtonIntervalWrapper(increment, () => buttonFunction(1))

        const { customSlider, ruler } = sliderContainer

        const { thumb, track } = customSlider
        thumb.className = thumb.part = "thumb"
        const { fill } = track
        fill.className = fill.part = "track-fill"
        track.appendChild(fill)
        track.className = track.part = "track"
        customSlider.className = "custom-slider-appearance"
        customSlider.append(track, thumb)        

        const { ticks, labels } = ruler
        ruler.className = "ruler"
        labels.className = "labels"
        ticks.className = "ticks"
        // This adds the containers,
        // the individual ticks and labels are created in the property setters
        ruler.append(ticks, labels)        

        sliderContainer.className = "slider-container"
        sliderContainer.part = "slider"
        sliderContainer.append(hiddenInputRange, customSlider, ruler)
    }

    #addCSS(){
        const css = new CSSStyleSheet()

        css.insertRule(`:host {
            display: grid;
            grid-template-columns: auto 1fr auto;
            column-gap: 3px;
            min-width: 10rem;
            max-width: 24rem;
            box-sizing: content-box;
            margin-block: 10px;
            color: light-dark(black, white);
            user-select: none;
            &:host([hidden]) { display: none !important; }
            &:host(:disabled) { filter: grayscale(1); }
        }`)

        // Needs the webkit specific properties! 
        css.insertRule(`button {
            grid-row: 2;
            --size: 1.25em;
            width: var(--size);
            height: var(--size);
            font-size: 1rem;
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

            user-select: none;
            touch-action: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;

            &:enabled:is(:hover, :active) { background-color: revert; }
            &:disabled { color: gray; opacity: 0.4; }
        }`)

        // width is set by Javascript 
        css.insertRule(`input[type = "text"] {
            z-index: 2;
            grid-row: 3 / 5;
            grid-column: 2;        
            min-width: fit-content;
            text-align: center;
            font-size: 0.9rem;
            padding: 2px;
            box-sizing: content-box;
            border: 1px solid light-dark(#bbb, #555);
            border-radius: 4px;
            color: inherit;
            margin: auto;
            margin-block: 2px;
            &:disabled { opacity: 0.4 }
            &:host([labels = "all"]) > input[type = "text"]{
                grid-row: 1;
            }
        }`)
        css.insertRule(`:host([labels = "all"]) > input[type = "text"]{
            grid-row: 1;
        }`)
        
        css.insertRule(`input[type = "range"].hidden-overlay {
            z-index: 2;
            position: absolute;
            inset: 0;
            min-width: 0;
            margin: 0;
            opacity: 0;
        }`)

        css.insertRule(`.slider-container {
            grid-row: 2 / 4;
            grid-column: 2;
            display: grid;
            grid-template-rows: subgrid;
            position: relative;
            margin: 0;
            padding: 0;
            border: 0;

            &:disabled { filter: contrast(0.8) opacity(0.5); }
            &:enabled:hover{
                --track-background: light-dark(#d2d2d2, #3c3c3c);
                --track-fill-background: light-dark(#409cff, #44a1ff);
                --thumb-shadow: 0 1px 2px hsla(0 0% 0% / 50%);
            }
            &:enabled:active{
                --thumb-border: 
                    calc(min(var(--thumb-width), var(--thumb-height)) *0.35) 
                    solid var(--track-fill-background);
            }

            --thumb-width: 1rem;
            --thumb-height: 1rem;
            --thumb-radius: var(--thumb-height);
            --thumb-background: white;
            --thumb-border: 2px solid var(--track-fill-background);
            --thumb-shadow: 0 1px 1px hsla(0, 0%, 0%, 30%);

            --track-height: 4px;
            --track-radius: var(--track-height);
            --track-background: light-dark(gainsboro, #353535);
            --track-fill-background: light-dark(dodgerblue, #3e94e8);

            --hover-track: color-mix(in oklch, var(--track-background), gray 10%);
            --hover-track-fill: color-mix(in oklch, var(--track-fill-background), white 10%);            
        }`)

        css.insertRule(`.custom-slider-appearance{
            display: flex;
            align-items: center;
            position: relative;
            display: grid;
            /* circular-out */
            --track-transition: 100ms cubic-bezier(0.08, 0.82, 0.17, 1);

            & > .thumb {
                grid-area: 1/1;
                width: var(--thumb-width);
                height: var(--thumb-height);
                border-radius: var(--thumb-radius);
                background: var(--thumb-background);
                border: var(--thumb-border);
                box-shadow: var(--thumb-shadow);
                box-sizing: border-box;
                transition: 
                    border-width 50ms linear,
                    margin-left var(--track-transition);
            }
            & > .track{
                    grid-area: 1/1;
                    width: 100%;
                    height: var(--track-height);
                    border-radius: var(--track-radius);
                    background: var(--track-background);
                    overflow: hidden;
                & > .track-fill{
                    display: block;
                    height: 100%;
                    background: var(--track-fill-background);
                    transition: width var(--track-transition);
                }
            }
        }`)

        css.insertRule(`.ruler {
            padding-inline: calc(var(--thumb-width, 18px) / 2);
            margin-top: -2px;

            & > .labels, & > .ticks{
                display: flex;
                justify-content: space-between;            
                & > span { display: none; }
            }
            & > .labels > span{
                width: 0px;
                font-family: monospace;
                font-size: 0.8rem;
                color: gray;
            }
            & > .ticks > span.width-zero-centering{
                width: 0px;
                & > .tick{
                    width: 1px;
                    height: 6px;
                    flex-shrink: 0;
                    margin-top: -4px;
                    background-color: gray;
                    border-radius: 1px;
                }
            }
        }`)

        css.insertRule(`
            :host([labels = "all"]) .labels > span,
            :host([ticks = "all"]) .ticks > span.width-zero-centering,
            :host([labels = "min-max"]) .labels > :is(:first-child, :last-child),
            :host([ticks = "min-max"]) .ticks > :is(:first-child, :last-child){
                display: flex;
                justify-content: center;
            }
        `)

        this.shadowRoot.adoptedStyleSheets = [css]
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

customElements.define(componentName, EnhancedSlider)