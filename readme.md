# WIP - documentation might not be up do date!

# enhanced-slider

A web component that combines the functionality of `<input type="range">` and `<input type="number">`.

[Try it on the demo page](https://alexander-holm.github.io/enhanced-slider/)

## Attributes and properties

Attributes are set on the component in HTML:
```html
<enhanced-slider min="1" max="10"></enhanced-slider>
```
They are all linked to the underlying properties with the same name and can be accessed through Javascript.
```javascript
const slider = document.querySelector("enhanced-slider")
slider.value = 5
```

### Number types

These can be set with either numbers or strings. Note that just like `<input type="number>`, these properties will always return its value as a string.

```javascript
slider.value = 10
console.log(slider.value) // "10"
```

#### step

Default: 1  
The interval between allowed numbers. Has to be a number, a string value of "any" is not allowed.

#### min
Default: 0  
Minimum value allowed.

#### max

Default: 100  
Maximum value allowed. If it cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can.

#### value

Default: halfway between min and max  
+ Values above `max` are set to `max`
+ Values below `min` are set to `min`
+ If the `value` cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can.
+ Other invalid values like text are rejected and the `value` will be set to the last correct one.

If `min`, `max`, or `step` contain decimals, `value` will always have decimals as well
```javascript
slider.step = 0.25
slider.value = 5
console.log(slider.value) // "5.00"
```
Like a native `<input>` element, the underlying `value` property does not reflect its value back to the attribute. Do not try to read the value from the attribute.
```javascript
let value
// Correct
value = slider.value
// Wrong
value = slider.getAttribute("value")
```

### Bolean types

If the attribute is present it is interpreted as true, no matter what value is assigned. The default is always false.

```html
<!-- These sliders are all disabled -->
<enhanced-slider disabled></enhanced-slider>
<enhanced-slider disabled="true"></enhanced-slider>
<enhanced-slider disabled="false"></enhanced-slider>
```

Uses booleans for setting and getting the properties.

```javascript
slider.disabled = true
console.log(slider.disabled) // true
```

#### disabled

Disables user interaction (Javascript interaction is not disabled).  
`value` will not be submitted with a form.

#### vertical

Vertical slider but input-box and labels are kept horizontal. Note that this sets the CSS property `writing-mode: sideways-lr;` so centering with `margin: auto;` might not work.

### String types

#### name

This name is submitted along with the component's value when the form data is submitted. If there is no name specified, or name is empty, the component's value will not be submitted with the form!

#### ticks

Displays vertical markers for a `step`.

+ "min-max" (default)
+ "all"
+ "none"

#### labels

Displays the numbers for a `step`.

+ "min-max" (default)
+ "all"
+ "none"

## Methods

### stepUp()

Increment the `value` by one `step`. The optional parameter `count` can be used to increase the `value` by several steps.
```javascript
slider.step = 2
slider.value = 10
stepUp()   // 12
stepUp()   // 14
stepUp(3)  // 20
```

### stepDown()

Same as `stepUp()` except the value is decremented.

### Events

#### valueupdate

Fires when the `value` property is changed through user action. 

#### input

Fires 

#### change






## Style

There are three ways to change the style:
1. Regular CSS applied to the entire component
2. Selecting individual parts with the `::part()` selector
3. Changing button content with `<slot>` elements

### CSS selecting the entire component

The component can be selected like any other HTML element using the tag name, a class, or an ID.
```css
enhanced-slider {
    max-width: 500px;
    margin-inline: auto;
}
```

### Individual parts using the `::part()` selector

```css
/* Applies to both buttons */
enhanced-slider::part(button){ color: white; }
/* Individual buttons */
enhanced-slider::part(decrement){ background-color: blue; }
enhanced-slider::part(increment){ background-color: red; }
```

#### slider

+ The `<input type="range">` element

#### input-box

+ The `<input type="text">` element (not `type="number"`)

#### button

+ This selects both left and right `<button>` elements 
+ By default the buttons are square shaped with the same `width` and `height`. The size for both is set by the CSS variable `--size: 1.25em;`. 
    + The easiest way to change size is with `font-size` and `padding`.
    + If you want the size to fit the contents just set `width` and `height` to `auto`.
+ Select an individual `<button>` with:
    1. *decrement*
    2. *increment*

#### labels

+ The container for the `min`and `max` labels

#### label

+ This selects both `min`and `max` labels
+ Select an individual label with:
    1. *min*
    2. *max*

