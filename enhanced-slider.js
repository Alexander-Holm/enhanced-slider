export { EnhancedSlider }

class EnhancedSlider extends HTMLElement{
    static get tagName(){ return "enhanced-slider" }
    static formAssociated = true
    constructor(){
        super()
        this.connected = false
        this.internals = this.attachInternals()
        this.attachShadow({mode: "open"})
    }
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
        const { slider, inputBox, buttons } = this.children

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

    children = {
        slider: undefined, inputBox: undefined,
        buttons: { decrement: undefined, increment: undefined },
        labels: { min: undefined, max: undefined }
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
            column-gap: 2px;
            min-width: 10rem;
            max-width: 24rem;
            box-sizing: content-box;
            margin-block: 10px;
        }`)        
        style.sheet.insertRule(`:host([hidden]) {
            display: none;
        }`)
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
            font-size: 0.9em;
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
            margin-top: calc(-6px + var(--labels-vertical, 0px))
        }`)
        style.sheet.insertRule(`:host(:disabled) > .labels {
            opacity: 50%;
        }`)
        // width:0 makes the ticks position perfectly mirrored
        style.sheet.insertRule(`.label {
            width: 0;
            overflow: visible;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: gray;
            font-size: 0.9em;
            font-family: monospace;
        }`)
        style.sheet.insertRule(`.label > .tick {
            width: 1px;
            height: 4px;
            background-color: currentColor;
            margin-bottom: 0px;
        }`)
        style.sheet.insertRule(`button {
            --size: 0.8em;
            font-size: 1em;
            width: var(--size);
            height: var(--size);
            aspect-ratio: 1;
            box-sizing: content-box;
            padding: 6px;
            margin: auto;
            border: 0px;
            border-radius: 4px;
            background-color: transparent;
            color: light-dark(black, white);
            display: flex;
            justify-content: center;
            align-items: center;
            grid-row: 1;
            &:enabled:hover {
                background-color: revert;
            }
            &:disabled {
                opacity: 0.2;
            }
        }`)
    }
}

class ButtonIntervalWrapper{
    intervals = [150, 140, 130, 100, 80, 60]
    intervalIndex = 0
    onInterval = null
    timerId = null
    button = null
    constructor(htmlButton, onInterval){
        this.button = htmlButton
        this.onInterval = onInterval
        // Have to use bind, otherwise "this" inside the functions will refer to the clicked button
        htmlButton.onmouseup = htmlButton.onmouseleave = htmlButton.ontouchend = htmlButton.ontouchcancel = htmlButton.onkeyup = this.stopInterval.bind(this)
        htmlButton.onmousedown = htmlButton.ontouchstart = this.startInterval.bind(this)
        htmlButton.onkeydown = (e) => {
            if(e.key === "Enter" && e.repeat === false)
                this.startInterval()
        }
    }
    // preventDefault() is required for button holding to work correctly on mobile
    startInterval(event){
        event.preventDefault()
        if(this.button.disabled){
            this.stopInterval()
            return
        }
        this.onInterval?.call()
        let interval
        if(this.intervalIndex < this.intervals.length)
            interval = this.intervals[this.intervalIndex++]
        else interval = 50
        // setTiemout argument needs to be an arrow function
        this.timerId = setTimeout(() => this.startInterval(event), interval)
    }
    stopInterval(){
        clearTimeout(this.timerId)
        this.intervalIndex = 0
    }
}

const icons = {
    left: `
        <svg viewBox="-5 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">
            <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
                <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-421.000000, -1195.000000)" fill="currentColor">
                    <path d="M423.429,1206.98 L434.686,1196.7 C435.079,1196.31 435.079,1195.67 434.686,1195.28 C434.293,1194.89 433.655,1194.89 433.263,1195.28 L421.282,1206.22 C421.073,1206.43 420.983,1206.71 420.998,1206.98 C420.983,1207.26 421.073,1207.54 421.282,1207.75 L433.263,1218.69 C433.655,1219.08 434.293,1219.08 434.686,1218.69 C435.079,1218.29 435.079,1217.66 434.686,1217.27 L423.429,1206.98" id="chevron-left" sketch:type="MSShapeGroup">
                    </path>
                </g>
            </g>
        </svg>
    `,
    right: `
        <svg viewBox="-5 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">
            <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
                <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-473.000000, -1195.000000)" fill="currentColor">
                    <path d="M486.717,1206.22 L474.71,1195.28 C474.316,1194.89 473.678,1194.89 473.283,1195.28 C472.89,1195.67 472.89,1196.31 473.283,1196.7 L484.566,1206.98 L473.283,1217.27 C472.89,1217.66 472.89,1218.29 473.283,1218.69 C473.678,1219.08 474.316,1219.08 474.71,1218.69 L486.717,1207.75 C486.927,1207.54 487.017,1207.26 487.003,1206.98 C487.017,1206.71 486.927,1206.43 486.717,1206.22" id="chevron-right" sketch:type="MSShapeGroup">
                    </path>
                </g>
            </g>
        </svg>
    `,
}

customElements.define(EnhancedSlider.tagName, EnhancedSlider)