export { EnhancedSlider }

const componentName = "enhanced-slider"

class EnhancedSlider extends HTMLElement{
    static formAssociated = true
    intervalEmitter = new IntervalEmitter()
    constructor(){
        super()
        this.connected = false
        // internals is needed to get associated labels and
        // set the value that is submitted with a form.
        this.internals = this.attachInternals()
        // delegatesFocus:true to focus the first input (appears first in HTML) when an outside label is clicked.
        // It also delegates focus when other non-clickable parts of this component is clicked.
        // Delegating focus when non-clickable parts are clicked is not wanted becuase it 
        // brings up the keyboard on mobile if you misclick below the slider or the buttons.
        // pointer-events to none and auto in CSS for the relevant elements prevents this unwanted focus.
        this.attachShadow({mode: "open", delegatesFocus: true})
        
        const { inputBox, buttons, sliderContainer } = this.children
        // This does not insert any HTML into the document,
        // that can only happen in connectedCallback()
        this.#configureHTMLElements(inputBox, buttons, sliderContainer)
        this.#addCSS()
        // For screanreaders.
        // Because there are two focusable elements described by the same outside label
        this.role = "group"
    }
    
    // These functions ending with callback are custom element lifecycle callbacks.
    // They are not called from in here and needs to have these exact names.
    connectedCallback(){
        this.#initializeProperties()
        const { sliderContainer, inputBox, buttons } = this.children
        // inputBox needs to be first in order to receive focus when clicking an associated label. 
        // tab-index does not matter, the first input will always receive the focus.
        this.shadowRoot.append(inputBox, sliderContainer, buttons.decrement, buttons.increment)
        // Has to be done after adding all elements to DOM,
        // because the function reads thumb.offsetWidth.
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
        sliderContainer: Object.assign(document.createElement("div"), {
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
        this.#value = inputBox.value = inputBox.ariaValueNow = Number(hiddenInputRange.value).toFixed(this.decimalPrecision)
        this.internals.setFormValue(this.#value)
        
        this.#updateSliderPosition()
        this.#handleButtonState()
        return
    }

    #min
    get min(){ return this.#min }
    set min(newValue){
        if(this.#isNotNumber(newValue) || newValue === this.#min) return
        const { inputBox } = this.children
        const { hiddenInputRange } = this.children.sliderContainer
        hiddenInputRange.min = newValue
        this.#min = inputBox.ariaValueMin = hiddenInputRange.min
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
        const { inputBox } = this.children
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
        this.#max = inputBox.ariaValueMax = hiddenInputRange.max
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
        hiddenInputRange.disabled = inputBox.disabled = decrement.disabled = increment.disabled = this.#disabled
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

    stepUp(){
        const { value, step, max } = this.#getPropertiesAsNumbers()
        if(value < max) this.value = value + step
    }
    stepDown(){        
        const { value, step, min } = this.#getPropertiesAsNumbers()
        if(value > min) this.value = value - step
    }
    // These should only be called from user events as they dispatch onchange events
    #stepUpContinuous(event){
        event.preventDefault()
        const notRepeated = (event.repeat === undefined || event.repeat === false)
        const { value, max } = this.#getPropertiesAsNumbers()
        if(notRepeated && value < max){
            const element = event.currentTarget
            this.intervalEmitter.start(element, () => {
                const { value, max } = this.#getPropertiesAsNumbers()
                if(value < max){
                    this.stepUp()
                    this.dispatchEvent(new Event("change"))
                } 
                else this.intervalEmitter.stop(element)
            })
        }
    }
    #stepDownContinuous(event){
        event.preventDefault()
        const notRepeated = (event.repeat === undefined || event.repeat === false)
        const { value, min } = this.#getPropertiesAsNumbers()
        if(notRepeated && value > min){
            const element = event.currentTarget
            this.intervalEmitter.start(element, () => {
                const { value, min } = this.#getPropertiesAsNumbers()
                if(value > min) {
                    this.stepDown()
                    this.dispatchEvent(new Event("change"))
                }
                else this.intervalEmitter.stop(element)
            })
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
        const { value, max, min } = this.#getPropertiesAsNumbers()
        const percentDecimal = (value - min) / (max - min)
        const percent = percentDecimal * 100
        
        const { thumb, track } = this.children.sliderContainer.customSlider
        const thumbOffset = thumb.offsetWidth * percentDecimal

        thumb.style.left = `calc(${percent.toFixed(3)}% - ${thumbOffset.toFixed(3)}px)`
        track.fill.style.transform = `translateX(calc(
            ${(percent-100).toFixed(3)}% +
            ${((thumb.offsetWidth / 2) - thumbOffset).toFixed(3)}px
        ))` 
    }
   
    #configureHTMLElements(inputBox, buttons, sliderContainer){
        const { hiddenInputRange } = sliderContainer
        hiddenInputRange.type = "range"
        hiddenInputRange.className = "hidden-overlay"
        inputBox.type = "text"
        inputBox.autocomplete = "off"
        inputBox.role = "spinbutton"
        inputBox.className = inputBox.part = "input-box"

        hiddenInputRange.onkeyup = hiddenInputRange.onblur = () => this.intervalEmitter.stop(hiddenInputRange)
        inputBox.onkeyup = inputBox.onblur = () => this.intervalEmitter.stop(inputBox)
        // Handle dragging slider and writing in inputBox
        // inputBox should not be oninput,
        // the validation might reset the input as you are typing.
        hiddenInputRange.oninput = inputBox.onchange = (event) => {
            this.value = event.currentTarget.value
            this.dispatchEvent(new Event("change"))
        }
        // Handle keyboard
        hiddenInputRange.onkeydown = (event) => {
            switch(event.key){
                case "ArrowUp":
                case "ArrowRight":
                    this.#stepUpContinuous(event)
                    break;
                case "ArrowDown":
                case "ArrowLeft":
                    this.#stepDownContinuous(event)
                    break;
            }
        }
        inputBox.onkeydown = (event) => {
            switch(event.key){
                case "ArrowUp": this.#stepUpContinuous(event); break;
                case "ArrowDown": this.#stepDownContinuous(event); break;
            }
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
        // Buttons should not receive focus, instead focus the inputBox,
        // similiar to <input type=number">
        decrement.onpointerup = decrement.onpointerleave = decrement.onpointercancel = 
        increment.onpointerup = increment.onpointerleave = increment.onpointercancel = (event) => {
            //Don't stop the interval when hovering a button if that button is not what started it.
            const button = event.currentTarget
            if(this.intervalEmitter.currentUser === button){
                this.intervalEmitter.stop(button)
                inputBox.focus()
            }
        } 
        decrement.onpointerdown = (event) => this.#stepDownContinuous(event)
        increment.onpointerdown = (event) => this.#stepUpContinuous(event)

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

        sliderContainer.className = sliderContainer.part = "slider"
        sliderContainer.append(hiddenInputRange, customSlider, ruler)

        // Dont't read all labels.
        // If screenreaders want to announce min and max it
        // can read it from inputBox.ariaValueMin and max.
        ruler.ariaHidden = true
        // The buttons don't need to be tabbable or visible to screenreaders.
        // Both inputBox and slider provice the same functionality to keyboard users.
        decrement.ariaHidden = true
        increment.ariaHidden = true
        decrement.tabIndex = -1
        increment.tabIndex = -1
        // Make tab order same as visual order.
        // inputBox has to come first in HTML in order to receive
        // focus when a label is clicked.
        hiddenInputRange.tabIndex = 1
        inputBox.tabIndex = 2
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

            --default-color: light-dark(dodgerblue, #3e94e8);
            --focus-outline: 2px solid var(--default-color);
        }`)
        css.insertRule(`:host([hidden]){ display: none !important; }`)
        css.insertRule(`:host(:enabled){
            pointer-events: none;
            & > .input-box, & > .slider, & > button { 
                pointer-events: auto;
            }
        }`)
        // button disabled state is set in the button rule
        // because buttons can be disabled without the host
        // (min or max reached)
        css.insertRule(`:host(:disabled){
            filter: grayscale(1);
            & > .input-box { pointer-events: none; opacity: 0.4 }
            & > .slider { pointer-events: none; filter: contrast(0.8) opacity(0.5); }
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

            &:enabled:hover { background-color: hsla(0, 0%, 50%, 0.1); }
            &:disabled { pointer-events: none !important; opacity: 0.25; }
        }`)

        // width is set by Javascript 
        css.insertRule(`.input-box {
            appearance: textfield;
            z-index: 2;
            grid-row: 3 / 5;
            grid-column: 2;        
            min-width: 3ch;
            text-align: center;
            font-size: 0.9rem;
            padding: 2px;
            box-sizing: content-box;
            border: 1px solid light-dark(#bbb, #555);
            border-radius: 4px;
            color: inherit;
            margin: auto;
            margin-block: 2px;
            &:focus { outline: var(--focus-outline, auto); }
        }`)
        css.insertRule(`input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }`)
        css.insertRule(`:host([labels = "all"]) > .input-box{
            grid-row: 1;
        }`)
        
        css.insertRule(`input[type = "range"].hidden-overlay {
            z-index: 1;
            grid-row: 1/3;
            grid-column: 1;
            min-width: 0;
            margin: 0;
            opacity: 0;
            &:focus-visible + .custom-slider-appearance {
                outline: var(--focus-outline, auto);
                outline-offset: 2px;
            }
        }`)

        css.insertRule(`.slider {
            grid-row: 2 / 4;
            grid-column: 2;
            display: grid;
            grid-template-rows: subgrid;
            margin: 0;
            padding: 0;
            border: 0;

            --track-height: 4px;
            --track-radius: var(--track-height);
            --track-background: light-dark(gainsboro, #353535);
            --track-filter: none;

            --track-fill-background: var(--default-color);
            --track-fill-filter: none;

            --thumb-width: 1rem;
            --thumb-height: 1rem;
            --thumb-radius: var(--thumb-height);
            --thumb-background: white;
            --thumb-shadow: 0 1px 1px hsla(0, 0%, 0%, 30%);
            --thumb-border-color: var(--track-fill-background);
            --thumb-border-width: 2px;
            --thumb-border-style: solid;
            --thumb-filter: none;

            &:hover {
                --track-filter: brightness(0.95);
                /* 
                    track-fill is a child of track and gets both filters.
                    Use some math to make fill and thumb the same brightness.
                */
                --track-fill-filter: brightness(1.158) contrast(1.3);
                --thumb-filter: brightness(1.1) contrast(1.3);
                --thumb-shadow: 0 1px 2px hsl(0 0% 0% / 50%);
            }
            &:active{
                --thumb-border-width: calc(min(var(--thumb-width), var(--thumb-height)) *0.35);
            }
            
        }`)
        // Highest z-index for the focus outline to not fall behind input-box.
        // No pointer-events so than the inputs behind can be clicked!
        // border-radius for focus outline.
        css.insertRule(`.custom-slider-appearance{
            z-index: 3;
            pointer-events: none;
            grid-area: 1/1;
            display: grid;
            align-items: center;
            border-radius: var(--track-radius);
            /* circular-out */
            --track-transition: 100ms cubic-bezier(0.08, 0.82, 0.17, 1);

            & > .thumb {
                grid-area: 1/1;
                position: relative;
                width: var(--thumb-width);
                height: var(--thumb-height);
                border-radius: var(--thumb-radius);
                background: var(--thumb-background);
                border-color: var(--thumb-border-color);
                border-width: var(--thumb-border-width);
                border-style: var(--thumb-border-style);
                box-shadow: var(--thumb-shadow);
                filter: var(--thumb-filter);
                box-sizing: border-box;
                background-clip: content-box;
                will-change: border-width, left;
                transition: 
                    border-width 50ms linear,
                    left var(--track-transition);
            }
            & > .track{
                grid-area: 1/1;
                width: 100%;
                box-sizing: border-box;
                height: var(--track-height);
                border-radius: var(--track-radius);
                background: var(--track-background);
                filter: var(--track-filter);
                overflow: hidden;
                & > .track-fill{
                    display: block;
                    height: 100%;
                    width: 100%;
                    background: var(--track-fill-background);
                    filter: var(--track-fill-filter);
                    will-change: transform;
                    transition: transform var(--track-transition);
                }
            }
        }`)

        css.insertRule(`.ruler {
            grid-row: 2;
            grid-column: 1;
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

class IntervalEmitter{
    intervals = [200, 150, 100, 100, 60, 60, 30]
    intervalIndex = 0
    onInterval = null
    timerId = null
    currentUser = null
    stop = (caller) => {
        if(caller !== this.currentUser) return
        clearTimeout(this.timerId)
        this.timerId = null
        this.intervalIndex = 0
        this.onInterval = null
        this.currentUser = null
    }
    start = (caller, onInterval) => {
        if(this.timerId !== null) this.stop(this.currentUser)
        this.currentUser = caller
        this.onInterval = onInterval
        this.loop()
    }
    loop = () => {
        const interval = this.intervals[this.intervalIndex]
        // Stay at the last index until stopped
        if(this.intervalIndex < this.intervals.length - 1)
            this.intervalIndex++
        this.timerId = setTimeout(this.loop, interval)
        this.onInterval?.call()
    }
}

customElements.define(componentName, EnhancedSlider)