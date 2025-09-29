# Frontend Mentor - Weather app solution

This is a solution to the [Weather app challenge on Frontend Mentor](https://www.frontendmentor.io/challenges/weather-app-K1FhddVm49). Frontend Mentor challenges help you improve your coding skills by building realistic projects. 

## Table of contents

- [Overview](#overview)
  - [Screenshot](#screenshot)
  - [Links](#links)
  - [Custom Features](#custom-features)
- [My process](#my-process)
  - [Built with](#built-with)
  - [What I learned](#what-i-learned)
  - [Continued development](#continued-development)

## Overview

### Screenshot

![](./design/screenshot.png)

### Links

- Solution URL: [Solution](https://www.frontendmentor.io/solutions/weather-app-interactive-weather-forecast-wMUMTvUlYL)
- Live Site URL: [Live demo](https://weather-hackathon-fm.netlify.app/)

### Custom Features

- Light theme
- Sunrise & sunset times
- Custom loading element
- Geolocation
- Weekly trends
- Favourites
- Location comparisons
- Weather radar
- Weather icons
- UV index, visibility, air pressure, dew point data
- Tips

## My process

### Built with

- Semantic HTML5 markup
- CSS custom properties
- Flexbox
- CSS Grid
- Mobile-first workflow
- Multiple API integrations (Open-Meteo, Geocoding, RainViewer)
- Leaflet.js for mapping
- LocalStorage for user preferences and favourites
- CSS animations


### What I learned

Working on this project has taught me many techniques and approaches to web development. Here are some of my key learnings:

#### CSS Animations

I created interactive weather animations that change based on the current weather condition, allowing the website to feel more dynamic. I also applied this to the loading animation.

```css
.rain-drop {
  position: absolute;
  width: 1px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.6));
  height: 20px;
  top: -20px;
  animation: rainfall linear infinite;
}

@keyframes rainfall {
  from {transform: translateY(0); opacity: 0;}
  10% {opacity: 1;}
  90% {opacity: 1;}
  to {transform: translateY(100vh); opacity: 0;}
}
```

#### Accessibility

Whilst I did not integrate accessibility completely, I certainly did my best in ensuring the HTML was clear and followed good practices using docs.

```html
<div class="weather-navigation" role="group" aria-label="Weather details navigation">
  <button class="nav-arrow nav-prev" aria-label="Previous weather details" tabindex="0">
    <img src="assets/images/icon-dropdown.svg" alt="" />
  </button>
  <div class="pagination-dots">
    <span class="dot active" data-index="0" id="tab-dot-1" role="tab" 
          aria-selected="true" aria-controls="details-tab-1" tabindex="0">
    </span>
  </div>
</div>
```

#### API Integration

This was my first project in which I used APIs, so it was a challenge understanding how to integrate the APIs - but after reading through documentation, I was able to understand how to do so.

### Continued development

I am not comfortable with accessibility, and will continue to move forward with focusing on that in future projects. 
