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

+ The interval between allowed numbers
+ Default: 1
+ Has to be a number, a string value of "any" is not allowed

#### min
+ Minimum value allowed
+ Default: 0

#### max

+ Maximum value allowed
+ Default: 100
+ If it cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can

#### value

+ Default: halfway between min and max
+ If it cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can
+ Validation:
    + Values above `max` are set to `max`
    + Values below `min` are set to `min`
    + Other invalid values like text are rejected
+ If `min`, `max`, or `step` contain decimals, `value` will always have decimals as well
    ```javascript
    slider.step = 0.25
    slider.value = 5
    console.log(slider.value) // "5.00"
    ```
+ Like a native `<input>` element, the underlying `value` property does not reflect its value back to the attribute. Do not try to read the value from the attribute.
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

+ Disables user interaction
+ Javascript interaction is not disabled
+ `value` will not be submitted with a form

#### hide-labels

+ `min` and `max` will not be displayed

### String types

#### ticks

+ Displays vertical markers for a `step`
+ Allowed values:
    + "labels"
    + "all"
    + "none"
+ Default: "labels"

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
    accent-color: purple;
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

