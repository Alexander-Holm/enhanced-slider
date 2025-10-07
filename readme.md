# enhanced-slider

A web component that combines the functionality of `<input type="range">` and `<input type="number">`.

<a href="https://alexander-holm.github.io/enhanced-slider" target="_blank">Try it on the demo page</a>

[Try it on the demo page](https://alexander-holm.github.io/enhanced-slider/)

## Attributes and properties

Attributes are set on the component in HTML:
```html
<enhanced-slider min="2" max="10"></enhanced-slider>
```
They are linked to the underlying properties with the same name and can be accessed through Javascript. The properties can be set using either strings or numbers, but reading them will always return a string. The exception is `disabled` which is a boolean.
```javascript
const slider = document.querySelector("enhanced-slider")
slider.value = 5
console.log(slider.value) // "5"
```

+ step
    + Default: 1
    + The interval between allowed numbers
    + Has to be a number, a string value of "any" is not allowed
    + If you prefer the `value` to be displayed with a certain amount of decimals you can add them in a string `step="1.0"`
+ min
    + Default: 0
+ max
    + Default: 100
    + If it cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can
+ value
    + Default: halfway between min and max
    + If it cannot be reached exactly with steps starting from the `min` value, it will get rounded to a number that can
    + Has validation and does not allow invalid values like strings or out of bounds numbers
    + If `min`, `max`, or `step` contains decimals, `value` will always have decimals as well.
        ```javascript
        slider.step = 0.25
        slider.value = 5
        console.log(slider.value) // "5.00"
        ```
    + Like a native `<input>` element, the underlying `value` property does not reflect its value back to the attribute
+ disabled
    + If this attribute is present (even with the value "false") the component will be disabled
    + Only user iteractions are disabled, the component can still be changed with Javascript

## Style

There are three ways to change the style:
1. Regular CSS applied to the entire component
2. Selecting individual parts with the `::part()` selector
3. Changing icons with `<slot>` elements

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
enhanced-slider::part(increment){ background-color: red; }
enhanced-slider::part(decrement){ background-color: blue; }
```

#### Available parts



