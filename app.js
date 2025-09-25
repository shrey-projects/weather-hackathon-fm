// Global variables

let isMetric = true;
let currentLat = null;
let currentLon = null;
let isCurrentLocationShown = false;
let searchTimeout = null;
let favourites = [];
let radarMap = null;
let radarLayer = null;
let radarData = null;
let locationMarker = null;
let currentFrameIndex = -1;
let animationInterval = null;
let leafletLoaded = false;
let isTempMetric = true;
let isWindMetric = true;
let isPrecipMetric = true;

function fetchWeather(latitude, longitude, cityName = '', countryName = '', isCurrentLocation = false){
    // Show loading animation
    toggleLoading(true);

    // Individual unit settings
    const tempLabels = document.querySelectorAll('.dropdown-section:nth-child(2) .dropdown-label');
    const windLabels = document.querySelectorAll('.dropdown-section:nth-child(3) .dropdown-label');
    const precipLabels = document.querySelectorAll('.dropdown-section:nth-child(4) .dropdown-label');

    isTempMetric = tempLabels[0].classList.contains('active');
    isWindMetric = windLabels[0].classList.contains('active');
    isPrecipMetric = precipLabels[0].classList.contains('active');

    isMetric = isTempMetric && isWindMetric && isPrecipMetric;

    const tempUnit = isTempMetric ? 'celsius' : 'fahrenheit';
    const windUnit = isWindMetric ? 'kmh' : 'mph';
    const precipUnit = isPrecipMetric ? 'mm' : 'inch';

    // Open-Meteo API endpoint
    const unitParams = `&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}&precipitation_unit=${precipUnit}`;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weathercode,windspeed_10m,visibility,pressure_msl,uv_index,dewpoint_2m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto${unitParams}`;    
        
    fetch(url)
    .then(res => res.json())
    .then(data => {
        if (isCurrentLocation) {
            currentLat = latitude;
            currentLon = longitude;
            isCurrentLocationShown = true;
        } else {
            isCurrentLocationShown = false;
        }

        // Get current weather
        const current = data.current_weather;

        // Get today's date
        const today = new Date();
        const options = {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'};
        const dateString = today.toLocaleDateString(undefined, options);

        // Get hourly data arrays and time index for current hour
        const hourly = data.hourly;
        const currentWeatherTime = current.time;

        // Closest hour index function
        function findClosestHourIndex(hourlyTimes, currentTime) {
            const currentDate = new Date(currentTime);
            let closestIndex = 0;
            let minDiff = Infinity;
            for (let i = 0; i < hourlyTimes.length; i++) {
                const hourlyDate = new Date(hourlyTimes[i]);
                const diff = Math.abs(hourlyDate - currentDate);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                }
            }
            return closestIndex;
        }

        const currentHourIndex = findClosestHourIndex(hourly.time, currentWeatherTime);
        
        locationTimezone = data.timezone;

        // Icon mapping
        const iconMap = Object.assign(
            ...[
                [[0], 'icon-sunny.webp'],
                [[1, 2], 'icon-partly-cloudy.webp'],
                [[3], 'icon-overcast.webp'],
                [[45, 48], 'icon-fog.webp'],
                [[51, 53, 55, 56, 57], 'icon-drizzle.webp'],
                [[61, 63, 65, 66, 67], 'icon-rain.webp'],
                [[71, 73, 75, 77, 85, 86], 'icon-snow.webp'],
                [[80, 81, 82, 95, 96, 99], 'icon-storm.webp']
            ].map(([codes, icon]) => 
                Object.fromEntries(codes.map(code => [code, icon]))
            )
        );

        // Find the day index for current weather
        const currentDate = new Date(currentWeatherTime);
        const dayIndex = data.daily.time.findIndex(day =>
            currentDate >= new Date(day + "T00:00:00") && currentDate < new Date(day + "T23:59:59")
        );
        let isNightCurrent = false;
        if (dayIndex !== -1) {
            const sunrise = new Date (data.daily.sunrise[dayIndex]);
            const sunset = new Date (data.daily.sunset[dayIndex]);
            isNightCurrent = currentDate < sunrise || currentDate >= sunset;
        }

        // Set weather icon
        const weatherCode = current.weathercode;
        let iconFile;
        if (isNightCurrent && (weatherCode === 0 || weatherCode === 1 || weatherCode === 2)) {
            iconFile = weatherCode === 0 ? 'icon-night-clear.webp' : 'icon-night-partly-cloudy.webp';
        } else {
            iconFile = iconMap[weatherCode] || 'icon-sunny.webp';
        }
        document.getElementById('weather-icon').src = `assets/images/${iconFile}`;

        const weatherIcon = document.getElementById('weather-icon')
        if (weatherIcon) {
            weatherIcon.src = `assets/images/${iconFile}`;
        } else {
            console.warn("Weather icon element not found");
        }

        // Update location and date
        const locationText = isCurrentLocation ? 'Current Location' : (cityName ? (countryName && cityName !== countryName ? `${cityName}, ${countryName}` : cityName) : 'Unknown location');
        document.getElementById('weather-location').textContent = locationText;
        document.getElementById('weather-date').textContent = dateString;

        // Update temperature
        document.getElementById('weather-temperature').innerHTML = `<i>${Math.round(current.temperature)}°</i>`;


        // Feels like temperature
        const feelsLike = hourly.apparent_temperature[currentHourIndex];
        document.getElementById('weather-feelslike').textContent = feelsLike !== undefined ? `${Math.round(feelsLike)}°` : '--';

        // Humidity
        const humidity = hourly.relative_humidity_2m[currentHourIndex];
        document.getElementById('weather-humidity').textContent = humidity !== undefined ? `${Math.round(humidity)}%` : '--';

        // Precipitation
        const precipitation = hourly.precipitation[currentHourIndex];
        document.getElementById('weather-precip').textContent = precipitation !== undefined ? `${precipitation} ${isPrecipMetric ? 'mm' : 'in'}` : '--';


        // Wind
        document.getElementById('weather-wind').textContent = `${Math.round(current.windspeed)} ${isWindMetric ? 'km/h' : 'mph'}`;
        
        // UV Index
        const uvIndex = hourly.uv_index ? hourly.uv_index[currentHourIndex] : undefined;
        let uvLevel = '';
        let uvColor = '';

        if (uvIndex !== undefined && uvIndex > 0) {
            const uvVal = Math.round(uvIndex);
            if (uvVal < 3) {
                uvLevel = 'Low';
                uvColor = '#3EC73E';
            } else if (uvVal < 6) {
                uvLevel = 'Mod';
                uvColor = '#F9D747';
            } else if (uvVal < 8) {
                uvLevel = 'High';
                uvColor = '#FF8C24';
            } else if (uvVal < 11) {
                uvLevel = 'V.High';
                uvColor = '#FF6060';
            } else {
                uvLevel = 'Extr';
                uvColor = '#B567F8'; //
            }
    
            document.getElementById('weather-uv').innerHTML = `${uvVal} <span class="uv-indicator" style="background-color:${uvColor};" title="${getFullUvLevel(uvLevel)}">${uvLevel}</span>`;
        } else {
            document.getElementById('weather-uv').textContent = '--';
        }

        function getFullUvLevel(shortLevel) {
            const fullNames = {
                'Low' : 'Low',
                'Mod' : 'Moderate',
                'High' : 'High',
                'V.High' : 'Very High',
                'Extr' : 'Extreme'
            };
            return fullNames[shortLevel] || shortLevel;
        }

        // Visibility
        const visibility = hourly.visibility ? hourly.visibility[currentHourIndex] : undefined;
        let visibilityValue = '--';
        if (visibility !== undefined) {
            const convertedVisibility = isMetric ? visibility / 1000 : visibility / 1609;
            visibilityValue = `${Math.round(convertedVisibility)} ${isMetric ? 'km' : 'mi'}`;
        }
        document.getElementById('weather-visibility').textContent = visibilityValue;

        // Air Pressure
        const pressure = hourly.pressure_msl ? hourly.pressure_msl[currentHourIndex] : undefined;
        document.getElementById('weather-pressure').textContent = pressure !== undefined ? `${Math.round(pressure)} hPa` : '--';

        // Dew Point
        const dewPoint = hourly.dewpoint_2m ? hourly.dewpoint_2m[currentHourIndex] : undefined;
        document.getElementById('weather-dewpoint').textContent = dewPoint !== undefined ? `${Math.round(dewPoint)}°` : '--';

        const tip = getWeatherTip(data, currentHourIndex);
        document.getElementById('weather-tip').innerHTML = `
            <span class="weather-tip-icon">${tip.icon}</span>
            <span class="weather-tip-text">${tip.text}</span>
        `;

        // Update favourite icon
        const favouriteIcon = document.querySelector('.favourite-icon');
        if (favouriteIcon) {
            favouriteIcon.dataset.location = isCurrentLocation ? 'Current Location' : locationText;
            favouriteIcon.dataset.lat = latitude;
            favouriteIcon.dataset.lon = longitude;
            checkFavouriteStatus(latitude, longitude);
        }

        // Daily forecast mapping
        const dailyDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyList = document.querySelector('.daily-forecast ul');
        dailyList.innerHTML = '';

        const daily = data.daily;
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i]);
            const day = dailyDays[date.getDay()];
            const tempMax = Math.round(daily.temperature_2m_max[i]);
            const tempMin = Math.round(daily.temperature_2m_min[i]);
            const weatherCode = daily.weathercode[i];
            const iconFile = iconMap[weatherCode] || 'icon-sunny.webp';

            dailyList.innerHTML += `
                <li class="daily-card">
                    <span class="daily-day">${day}</span>
                    <img src="assets/images/${iconFile}" alt="" />
                    <div class="daily-temps">
                        <span class="daily-temperature">${tempMax}°</span>
                        <span class="daily-temperature-low">${tempMin}°</span>
                    </div>
                </li>
            `;
        }

        // Hourly forecast
        const hourlyList = document.querySelector('.hourly-forecast ul');
        
        // Get daily sunrise/sunset arrays
        const sunriseArr = daily.sunrise;
        const sunsetArr = daily.sunset;

        const hoursToShow = 24;
        
        // Populate hourly forecast dropdown
        populateHourlyDropdown(data, today, iconMap);

        // Render initial hourly forecast
        renderHourlyForecast(hourlyList, hourly, currentHourIndex, hoursToShow, daily, sunriseArr, sunsetArr, iconMap);

        // Get weekly trend
        getWeeklyTrend(latitude, longitude);

        // Setup weather background effects
        setWeatherBackground(weatherCode, isNightCurrent);

        toggleLoading(false, animateWeatherValues);

    })
    .catch(err => {
        console.error('Weather API error:', err);
        toggleLoading(false);
        
        const currentWeatherSection = document.querySelector('.item.current-weather');
        currentWeatherSection.innerHTML = `
            <div class="api-error">
                <img src="assets/images/icon-error.svg" alt="Error" />
                <h3>Unable to fetch weather data</h3>
                <p>There was a problem connecting to the weather service. Please try again later.</p>
                <button class="retry-button" onclick="location.reload()">Retry</button>
            </div>
        `;
        
        document.querySelector('.item.favourites-section').style.display = 'none';
        document.querySelector('.item.daily-forecast').style.display = 'none';
        document.querySelector('.item.hourly-forecast').style.display = 'none';
        document.getElementById('weather-comparison').style.display = 'none';
        
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            toggle.classList.remove('active');
    });
});
}

// Forecast display functions

// Populate the hourly dropdown with the days of the week
function populateHourlyDropdown(data, today, iconMap) {
    const dailyFullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyDates = data.daily.time;
    const dropdownMenu = document.querySelector('.hourly-dropdown-menu');
    const dropdownToggle = document.querySelector('.hourly-dropdown .dropdown-toggle');

    dropdownMenu.innerHTML = '';

    // Create buttons for each day in the forecast
    for (let i = 0; i < dailyDates.length; i++) {
        const date = new Date(dailyDates[i]);
        const dayName = i === 0 ? 'Today' : dailyFullDays[date.getDay()];
        const isActive = i === 0;

        // Create button element
        const button = document.createElement('button');
        button.className = `weekday-item ${isActive ? 'active' : ''}`;
        button.textContent = dayName;
        button.dataset.index = i;

        // Add to dropdown
        dropdownMenu.appendChild(button);
    }

    // Set default dropdown toggle text
    dropdownToggle.innerHTML = `Today <img class="dropdown-image" src="assets/images/icon-dropdown.svg" alt="" />`;

    // Add event listeners to dropdown items
    const dropdownItems = document.querySelectorAll('.hourly-dropdown-menu .weekday-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function () {
            dropdownItems.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const dayText = this.textContent;
            const dropdownTextSpan = dropdownToggle.querySelector('span') || document.createElement('span');
        
            if (!dropdownToggle.querySelector('span')) {
                // First time setup - restructure the toggle button
                dropdownTextSpan.textContent = dayText;
                const dropdownIcon = dropdownToggle.querySelector('img');
                dropdownToggle.innerHTML = '';
                dropdownToggle.appendChild(dropdownTextSpan);
                dropdownToggle.appendChild(dropdownIcon);
            } else {
                dropdownTextSpan.textContent = dayText;
            }

            // Get day index and render hourly forecast
            const dayIndex = parseInt(this.dataset.index);
            const hourlyList = document.querySelector('.hourly-forecast ul');
            const hourly = data.hourly;
            const daily = data.daily;
            const sunriseArr = daily.sunrise;
            const sunsetArr = daily.sunset;

            if (dayIndex === 0) {
                // For today, start from current hour
                const currentWeatherTime = data.current_weather.time;
                const currentHourIndex = findClosestHourIndex(hourly.time, currentWeatherTime);
                renderHourlyForecast(hourlyList, hourly, currentHourIndex, 24, daily, sunriseArr, sunsetArr, iconMap);
            } else {
                // For other days, find first hour of that day
                const dayDate = new Date(daily.time[dayIndex]);
                const firstHourIndex = hourly.time.findIndex(time => {
                    const hourDate = new Date(time);
                    return hourDate.getDate() === dayDate.getDate() &&
                           hourDate.getMonth() ===  dayDate.getMonth() &&
                           hourDate.getFullYear() === dayDate.getFullYear();
                });
                renderHourlyForecast(hourlyList, hourly, firstHourIndex, 24, daily, sunriseArr, sunsetArr, iconMap);
            }
        })
    });
}

// Find closest hour index
function findClosestHourIndex(hourlyTimes, currentTime) {
    const currentDate = new Date(currentTime);
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < hourlyTimes.length; i++) {
        const hourlyDate = new Date(hourlyTimes[i]);
        const diff = Math.abs(hourlyDate - currentDate);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }
    return closestIndex;
}

// Render hourly forecast for a specific start hour
function renderHourlyForecast(hourlyList, hourly, startIndex, hoursToShow, daily, sunriseArr, sunsetArr, iconMap) {
    hourlyList.innerHTML = '';
    let prevDay = null;

    for (let i = startIndex; i < startIndex + hoursToShow; i++) {
        if (i >= hourly.time.length) break;
        const hourDate = new Date(hourly.time[i]);
        const hourLabel = hourDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
        const temp = Math.round(hourly.temperature_2m[i]);
        const weatherCode = hourly.weathercode[i];

        const dayIndex = daily.time.findIndex(day =>
            hourDate >= new Date(day + "T00:00:00") && hourDate < new Date(day + "T23:59:59")
        );

        // Get sunrise/sunset for this day
        let isNight = false;
        let sunriseTime, sunsetTime;
        if (dayIndex !== -1) {
            const sunrise = new Date(sunriseArr[dayIndex]);
            const sunset = new Date(sunsetArr[dayIndex]);
            sunriseTime = sunrise;
            sunsetTime = sunset;
            isNight = hourDate < sunrise || hourDate >= sunset;
        }

        // Swap icons
        let iconFile;
        if (isNight && (weatherCode === 0 || weatherCode === 1 || weatherCode === 2)) {
            iconFile = weatherCode === 0 ? 'icon-night-clear.webp' : 'icon-night-partly-cloudy.webp';
        } else {
            iconFile = iconMap[weatherCode] || 'icon-sunny.webp';
        }

        // Insert subheading if the day changes
        const currentDay = hourDate.getDate();
        if (prevDay !== null && currentDay !== prevDay) {
            const nextDayLabel = hourDate.toLocaleDateString(undefined, {weekday: 'long'});
            hourlyList.innerHTML += `
                <li class="hourly-day-separator">
                    <span>${nextDayLabel}</span>
                </li>
            `;
        }
        prevDay = currentDay;

        // Check for sunrise/sunset
        let isSunrise = false;
        let isSunset = false;

        if (sunriseTime && sunsetTime) {
            const sunriseHour = sunriseTime.getHours();
            const sunsetHour = sunsetTime.getHours();
            const currentHour = hourDate.getHours();

            isSunrise = currentHour === sunriseHour;
            isSunset = currentHour === sunsetHour;
        }

        // Always show the regular hourly forecast
        hourlyList.innerHTML += `
            <li class="hourly-card">
                <div class="hourly-card-time">
                    <img src="assets/images/${iconFile}" alt="" />
                    <span class="hour">${hourLabel}</span>
                </div>
                <span class="hourly-temperature">${temp}°</span>
            </li>
        `;

        if (isSunrise) {
            hourlyList.innerHTML += `
                <li class="hourly-card">
                    <div class="hourly-card-time">
                        <img src="assets/images/icon-sunrise.webp" alt="Sunrise" />
                        <span class="hour">${sunriseTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
                    </div>
                    <span class="hourly-temperature">Sunrise</span>
                </li>
            `;
        } else if (isSunset) {
            hourlyList.innerHTML += `
                <li class="hourly-card">
                    <div class="hourly-card-time">
                        <img src="assets/images/icon-sunset.webp" alt="Sunset" />
                        <span class="hour">${sunsetTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false})}</span>
                    </div>
                    <span class="hourly-temperature">Sunset</span>
                </li>
            `;                
        }
    }
}

// Unit toggle and UI functions

function toggleUnits() {
    isMetric = !isMetric;
    isTempMetric = isMetric;
    isWindMetric = isMetric;
    isPrecipMetric = isMetric;

    // Update dropdown button text
    const switchButton = document.querySelector('.dropdown-section:first-child .dropdown-switch');
    switchButton.textContent = isMetric ? 'Switch to Imperial' : 'Switch to Metric';

    // Update temperature unit labels
    const tempLabels = document.querySelectorAll('.dropdown-section:nth-child(2) .dropdown-label');
    tempLabels.forEach(label => label.classList.remove('active'));
    tempLabels[isMetric ? 0 : 1].classList.add('active');

    // Update winds peed unit labels
    const windLabels = document.querySelectorAll('.dropdown-section:nth-child(3) .dropdown-label');
    windLabels.forEach(label => label.classList.remove('active'));
    windLabels[isMetric ? 0 : 1].classList.add('active');

    // Update precipitation unit labels
    const precipLabels = document.querySelectorAll('.dropdown-section:nth-child(4) .dropdown-label');
    precipLabels.forEach(label => label.classList.remove('active'));
    precipLabels[isMetric ? 0 : 1].classList.add('active');

    // Refetch weather with new units

    if (isCurrentLocationShown && currentLat !== null && currentLon !== null) {
        fetchWeather(currentLat, currentLon, '', '', true);
    } else {
        const weatherLocation = document.getElementById('weather-location').textContent;
        if (weatherLocation) {
            // Get current location from displayed text
            const locationParts = weatherLocation.split(',');
            const cityName = locationParts[0].trim();
            const countryName = locationParts.length > 1 ? locationParts[1].trim() : cityName;
        
            // Find coordinates for this location (simplified version)
            fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`)
                .then(res => res.json())
                .then(geoData => {
                    if (geoData.results && geoData.results.length > 0) {
                        const result = geoData.results[0];
                        fetchWeather(result.latitude, result.longitude, result.name, result.country);
                    }
                });
        } else {
            // Default to Tokyo if no location is set
            fetchWeather(35.68, 139.65, 'Tokyo', 'Japan');
        }
    }

    // Check if comparison cards exist and refresh those with new units
    document.querySelectorAll('.comparison-card').forEach(card => {
        const resultId = card.closest('[id^="comparison-results"]').id;
        const inputName = resultId === 'comparison-results-1' ? 'comparison-location-1' : 'comparison-location-2';
        const inputValue = document.querySelector(`input[name="${inputName}"]`).value;

        if (inputValue) {
            fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputValue)}&count=1`)
                .then(res => res.json())
                .then(data => {
                    if (data.results && data.results.length > 0) {
                        const result = data.results[0];
                        fetchComparisonWeather(result.latitude, result.longitude, result.name, result.country, resultId);
                    }
                })
        }
    })
}

function toggleLoading(show, callback) {
    const loadingOverlay = document.querySelector('.loading-overlay');

    if (show) {
        document.body.style.overflow = 'hidden';
        loadingOverlay.classList.add('active');
    } else {
        setTimeout(() => {
            loadingOverlay.classList.remove('active');
            document.body.style.overflow = '';

            if (typeof callback === 'function') {
                callback();
            }
        }, 500);
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('img');

    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.src = 'assets/images/dark-mode.webp';
        themeIcon.alt = 'Switch to dark mode';
    }

    themeToggle.addEventListener('click', () => {
        // Toggle theme class on body
        document.body.classList.toggle('light-theme');

        // Update icon and save preference
        if (document.body.classList.contains('light-theme')) {
            themeIcon.src = 'assets/images/dark-mode.webp';
            themeIcon.alt = 'Switch to dark mode';
            localStorage.setItem('theme', 'light');
        } else {
            themeIcon.src = 'assets/images/light-mode.webp'
            themeIcon.alt = 'Switch to light mode';
            localStorage.setItem('theme', 'dark');
        }

        updateMapTilesForTheme();
    });
}

function setupWeatherDetailsNavigation() {
    const details = document.querySelectorAll('.weather-details');
    const prevBtn = document.querySelector('.nav-arrow.nav-prev');
    const nextBtn = document.querySelector('.nav-arrow.nav-next');
    const dots = document.querySelectorAll('.pagination-dots .dot');

    let currentIndex = 0

    // Hide prev button initially
    prevBtn.style.opacity = '0.3';
    prevBtn.style.pointerEvents = 'none';

    function showDetails(index) {
        // fade out current page
        details[currentIndex].style.opacity = '0';

        setTimeout(() => {
            // Hide all detail pages
            details.forEach(detail => detail.classList.remove('active'));

            // Show the selected page
            details[index].classList.add('active');

            // Fade in new page
            details[index].style.opacity = '1';

            // Update dots
            dots.forEach(dot => dot.classList.remove('active'));
            dots[index].classList.add('active');

            // Update button states
            prevBtn.style.opacity = index === 0 ? '0.3' : '1';
            prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';

            nextBtn.style.opacity = index === details.length - 1 ? '0.3' : '1';
            nextBtn.style.pointerEvents = index === details.length - 1 ? 'none' : 'auto';

            currentIndex = index;
        }, 150);
    }

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            showDetails(currentIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < details.length - 1) {
            showDetails(currentIndex + 1);
        }
    });

    // Add click handlers to dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            if (index !== currentIndex) {
                showDetails(index);
            }
        });
    });

    details.forEach((detail, index) => {
        if (index === 0) {
            detail.style.opacity = '1';
        } else {
            detail.style.opacity = '0';
        }
    });
}

// Search form submission
const searchForm = document.querySelector('.search-form')
const searchInput = document.querySelector('input[name="location"]');
const suggestionsContainer = document.querySelector('.search-suggestions');

// Search functionality

// Function to fetch city suggestions
function fetchCitySuggestions(query) {
    if (!query || query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`)
        .then(res => res.json())
        .then(data => {
            suggestionsContainer.innerHTML = '';

            if (data.results && data.results.length > 0) {
                data.results.forEach(city => {
                    const displayName = city.country === city.name ? city.name : `${city.name}, ${city.country}`;
                    const countryCode = city.country_code?.toUpperCase() || '';

                    const suggestion = document.createElement('div');
                    suggestion.classList.add('suggestion-item');

                    suggestion.innerHTML = `
                        ${countryCode ? `<img class="country-flag" src="https://flagsapi.com/${countryCode}/flat/32.png" alt="${city.country}" flag">` : ''}
                        <span>${displayName}</span>
                    `;

                    suggestion.addEventListener('click', () => {
                        fetchWeather(city.latitude, city.longitude, city.name, city.country);
                        searchInput.value = '';
                        suggestionsContainer.style.display = 'none';
                    });

                    suggestionsContainer.appendChild(suggestion);
                });

                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.innerHTML = `
                <div class="no-results">
                    <img src="assets/images/icon-error.svg" alt="No results found" />
                    <div class="no-results-title">No results found</div>
                    <div class="no-results-message">
                    Try searching for a city or adjust your search term.
                    </div>
                </div>
                `;
                suggestionsContainer.style.display = 'block';
            }
        })
        .catch(err => {
            console.error('Error fetching city suggestions:', err);
            suggestionsContainer.innerHTML = `
                <div class="no-results">
                <img src="assets/images/icon-error.svg" alt="Error" />
                <div class="no-results-title">Something went wrong</div>
                <div class="no-results-message">
                    There was a problem with your search. Please try again.
                </div>
                </div>
            `;
            suggestionsContainer.style.display = 'block';
        })
}

// Add input event listener for search suggestions
searchInput.addEventListener('input', function() {
    const query = this.value.trim();

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Set new timeout to avoid excessive API calls
    searchTimeout = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300);
});

// Show "Current location" option on focvus
searchInput.addEventListener('focus', function() {
    suggestionsContainer.innerHTML = '';

    // Add "Current Location" option
    const currentLocationOption = document.createElement('div');
    currentLocationOption.classList.add('suggestion-item', 'current-location-option');
    currentLocationOption.style.display = 'flex';
    currentLocationOption.style.alignItems = 'center';
    currentLocationOption.innerHTML = `
        <img src="assets/images/icon-location.svg" alt="Location" style="width: 14px; margin-right: 8px;" />
        Current Location
    `;

    currentLocationOption.addEventListener('click', () => {
        if (isCurrentLocationShown && currentLat !== null && currentLon !== null) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        if (navigator.geolocation) {
            toggleLoading(true);
            suggestionsContainer.style.display = 'none';
            searchInput.value = '';

            navigator.geolocation.getCurrentPosition(
                // Success callback
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeather(lat, lon, '', '', true);
                    searchInput.value = '';
                },
                // Error
                (error) => {
                    console.error('Geolocation error:', error);
                    toggleLoading(false);
                    searchInput.value = '';

                    let errorTitle, errorMessage ;
                    
                    if (error.code === 1) {
                        errorTitle = "Location access denied";
                        errorMessage = "Please enable location access in your browser settings or search for a city manually.";
                    } else if (error.code === 3) {
                        errorTitle = "Location request timed out";
                        errorMessage = "Couldn't get your location in time. Please try again or search for a city manually.";
                    } else {
                        errorTitle = "Location error";
                        errorMessage = "There was a problem getting your location. Please try again or search for a city manually.";
                    }

                    suggestionsContainer.innerHTML = `
                        <div class="no-results">
                            <img src="assets/images/icon-error.svg" alt="Location error" />
                            <div class="no-results-title">${errorTitle}</div>
                            <div class="no-results-message">
                                ${errorMessage}
                            </div>
                        </div>
                    `;
                    suggestionsContainer.style.display = 'block';
                },
                { timeout: 10000 }
            );
        } else {
            suggestionsContainer.innerHTML = `
                <div class="no-results">
                    <img src="assets/images/icon-error.svg" alt="Location error" />
                    <div class="no-results-title">Geolocation not supported</div>
                    <div class="no-results-message">
                        Your browser doesn't support geolocation. Please search for a city manually.
                    </div>
                </div>
            `;
            suggestionsContainer.style.display = 'block';
        }
    });

    suggestionsContainer.appendChild(currentLocationOption);
    suggestionsContainer.style.display = 'block';
});

searchForm.addEventListener('submit', function(e){
    e.preventDefault()
    const city = searchInput.value.trim();
    if (!city) return;

    toggleLoading(true);

    // Geocoding API
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
        .then(res => res.json())
        .then(geoData => {
            if (!geoData.results || geoData.results.length === 0){
                toggleLoading(false);
                suggestionsContainer.innerHTML = `
                  <div class="no-results">
                    <img src="assets/images/icon-error.svg" alt="No results found" />
                    <div class="no-results-title">No results found</div>
                    <div class="no-results-message">
                      We couldn't find "${city}". Try checking the spelling or searching for a different location.
                    </div>
                  </div>
                `;
                suggestionsContainer.style.display = 'block';
                return;
            }
            const result = geoData.results[0];
            
            // Call weather fetch function with new coordinates
            fetchWeather(result.latitude, result.longitude, result.name, result.country);

            searchInput.value = '';
        })
        .catch((err) => {
            console.error('Error searching for city:', err);
            toggleLoading(false);
            suggestionsContainer.innerHTML = `
              <div class="no-results">
                <img src="assets/images/icon-error.svg" alt="Error" />
                <div class="no-results-title">Something went wrong</div>
                <div class="no-results-message">
                  There was a problem with your search. Please try again.
                </div>
              </div>
            `;
            suggestionsContainer.style.display = 'block';
    });
})

// Favourites functionality

// Load favourites from localStorage
function loadFavourites() {
    const savedFavourites = localStorage.getItem('weatherFavourites');
    if (savedFavourites) {
        favourites = JSON.parse(savedFavourites);
        updateFavouritesUI();
    }
}

// Save fourites to localStorage
function saveFavourites() {
    localStorage.setItem('weatherFavourites', JSON.stringify(favourites));
}

// Toggle favourite status
function toggleFavourite(locationName, latitude, longitude, countryName) {
    const existingIndex = favourites.findIndex(fav =>
        fav.lat === latitude && fav.lon === longitude);

    if (existingIndex >= 0) {
        // Remove from favourites
        favourites.splice(existingIndex, 1);
        updateStarIcon(false);
    } else {
        // Add to favourites
        favourites.push({
            name: locationName,
            country: countryName || locationName,
            lat: latitude,
            lon: longitude
        });
        updateStarIcon(true);
    }

    saveFavourites();
    updateFavouritesUI();
}

// Update star icon based on favourite status
function updateStarIcon(isFavourite) {
    const favouriteIcon = document.querySelector('.favourite-icon');
    if (favouriteIcon) {
        favouriteIcon.src = isFavourite ? 'assets/images/star-fill.svg' : 'assets/images/star-outline.svg';
        favouriteIcon.alt = isFavourite ? 'Remove from favourites' : 'Add to favourites';
    }
}

// Check if current location is a favourite
function checkFavouriteStatus(latitude, longitude) {
    const isFavourite = favourites.some(fav =>
        fav.lat === latitude && fav.lon === longitude);
    updateStarIcon(isFavourite);
}

// Update favourites icon
function updateFavouritesUI() {
    const favouritesList = document.querySelector('.favourites-list');

    if (favourites.length === 0) {
        favouritesList.innerHTML = '<div class="no-favourites">No favourite locations added yet</div>';
        return;
    }

    let favouritesHTML = '';
    favourites.forEach(favourite => {
        let locationText;

        if (favourite.name === 'Current Location') {
            locationText = 'Current Location';
        } else if (!favourite.country || favourite.country === favourite.name) {
            locationText = favourite.name;
        } else {
            locationText = `${favourite.name}, ${favourite.country}`;
        }
    
        favouritesHTML += `
            <div class="favourite-card" data-lat="${favourite.lat}" data-lon="${favourite.lon}">
                <span class="favourite-location">${locationText}</span>
                <img src="assets/images/star-fill.svg" class="favourite-remove" 
                     data-lat="${favourite.lat}" data-lon="${favourite.lon}" alt="Remove favourite">
            </div>
        `;
    });

    favouritesList.innerHTML = favouritesHTML;

    // Add event listeners to favourite cards and remove buttons
    const favouriteCards = document.querySelectorAll('.favourite-card');
    favouriteCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Prevent click if they clicked the remove button
            if (e.target.classList.contains('favourite-remove')) return;

            const lat = parseFloat(this.dataset.lat);
            const lon = parseFloat(this.dataset.lon);
            const favourite = favourites.find(f => f.lat === lat && f.lon === lon);

            if (favourite) {
                if (favourite.name === 'Current Location') {
                    fetchWeather(lat, lon, '', '', true);
                } else {
                    fetchWeather(lat, lon, favourite.name, favourite.country);
                }
            }
        });
    });

    const removeButtons = document.querySelectorAll('.favourite-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const lat = parseFloat(this.dataset.lat);
            const lon = parseFloat(this.dataset.lon);

            // Removes from favourites
            const index = favourites.findIndex(f => f.lat === lat && f.lon === lon);
            if (index >= 0) {
                favourites.splice(index, 1);
                saveFavourites();
                updateFavouritesUI();

                // Update star icon if this is the current location
                const currentLat = parseFloat(document.querySelector('.favourite-icon').dataset.lat);
                const currentLon = parseFloat(document.querySelector('.favourite-icon').dataset.lon);

                if (currentLat === lat && currentLon === lon) {
                    updateStarIcon(false);
                }
            }
        });
    });
}

// Weather tips and trends

function getWeatherTip(data, currentHourIndex) {
    const current = data.current_weather;
    const hourly = data.hourly;
    const weatherCode = current.weathercode;
    const temp = current.temperature;
    const windspeed = current.windspeed;
    const uvIndex = hourly.uv_index ? hourly.uv_index[currentHourIndex] : undefined;
    const humidity = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[currentHourIndex] : undefined;

    let tips = [];

    if (temp <= 0) {
        tips.push({ icon: "❄️", text: "Stay cozy! It's freezing cold today."});
        tips.push({ icon: "🧣", text: "Layer up, it's freezing outside."});
    } else if (temp <= 10) {
        tips.push({ icon: "🧥", text: "Grab a jacket, it's chilly outside!"});
        tips.push({ icon: "☕", text: "Perfect weather for a hot drink."});
    } else if (temp <= 15) {
        tips.push({ icon: "🧥", text: "A thin jacket would be a good idea today."});
        tips.push({ icon: "🚶", text: "Great weather for an afternoon walk."});
    } else if (temp <= 22) {
        tips.push({ icon: "👌", text: "Perfect temperature outside, make the most of it!"});
        tips.push({ icon: "🍃", text: "Have a restful day in nature today!"});
    } else if (temp <= 28) {
        tips.push({ icon: "👕", text: "Perfect weather for a t-shirt!"});
        tips.push({ icon: "🍦", text: "Enjoy an ice cream today!"});
    } else {
        tips.push({ icon: "☀️", text: "It's hot today, stray hydrated and seek shade."});
        tips.push({ icon: "🧢", text: "Make sure to use sunscreen and a hat!"});
    }

    if ([0].includes(weatherCode)) {
        tips.push({ icon: "☀️", text: "Clear skies today, perfect weather to be outside!" });
        tips.push({ icon: "😎", text: "Don't forget your sunglasses today." });
    } else if ([1, 2].includes(weatherCode)) {
        tips.push({ icon: "⛅", text: "Partly cloudy, a good day for outdoor plans." });
        tips.push({ icon: "📸", text: "Beautiful clouds today, perfect for gazing at." });
    } else if ([3].includes(weatherCode)) {
        tips.push({ icon: "☁️", text: "Overcast today, good for a peaceful walk." });
        tips.push({ icon: "📚", text: "Cloudy day, perfect for catching up on errands." });
    } else if ([45, 48].includes(weatherCode)) {
        tips.push({ icon: "🌫️", text: "It's foggy, drive carefully if you're on the road." });
        tips.push({ icon: "🚗", text: "Reduced visibility due to fog, use headlights when driving." });
    } else if ([51, 53, 55, 56, 57].includes(weatherCode)) {
        tips.push({ icon: "🌦️", text: "Light drizzle, an umbrella might be useful." });
        tips.push({ icon: "👢", text: "Light rain, dress appropiately!" });
    } else if ([61, 63, 65, 66, 67].includes(weatherCode)) {
        tips.push({ icon: "🌧️", text: "Rainy day, don't forget your umbrella!" });
        tips.push({ icon: "☂️", text: "Rain expected, dress appropiately!" });
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
        tips.push({ icon: "❄️", text: "Snow is falling, enjoy the winter wonderland!" });
        tips.push({ icon: "🧣", text: "Snowy conditions, dress warmly and watch your step." });
    } else if ([80, 81, 82, 95, 96, 99].includes(weatherCode)) {
        tips.push({ icon: "⛈️", text: "Stormy weather, best to stay indoors if possible." });
        tips.push({ icon: "🌩️", text: "Thunderstorms expected, keep devices charged." });
    }
    
    if (uvIndex !== undefined && uvIndex >= 6) {
        tips.push({ icon: "☀️", text: "High UV today, apply sunscreen regularly." });
        tips.push({ icon: "🧢", text: "UV is strong, wear a hat and sunglasses." });
    }
    
    if (windspeed > 30) {
        tips.push({ icon: "💨", text: "Strong winds today, secure loose items outdoors." });
        tips.push({ icon: "🌬️", text: "Windy conditions, hold onto your hat!" });
    }
    
    if (humidity !== undefined && humidity > 85) {
        tips.push({ icon: "💧", text: "High humidity, it might feel warmer than it is." });
        tips.push({ icon: "💦", text: "Humid conditions, stay hydrated and dress lightly." });
    }
    
    if (tips.length > 0) {
        const randomIndex = Math.floor(Math.random() * tips.length);
        return tips[randomIndex];
    }
    
    return { icon: "💡", text: "Stay prepared for changing weather conditions!" };
}

function getWeeklyTrend(latitude, longitude) {
    const weeklyTrendElement = document.getElementById('weekly-trend-message');
    weeklyTrendElement.textContent = "Analyzing weekly trends...";
    weeklyTrendElement.className = "trend-message";

    const today = new Date();

    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - 1) // yesterday

    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // 7 days before yesterday

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    }

    const startDate = formatDate(lastWeekStart);
    const endDate = formatDate(lastWeekEnd);

    const unitParams = isMetric ? '' : '&temperature_unit=fahrenheit&precipitation_unit=inch';

    // fetch historical weather data
    const historyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto${unitParams}`;

    fetch(historyUrl)
        .then(res => res.json())
        .then(historyData => {
            // get forecast data for this week
            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto${unitParams}`;

            return fetch(forecastUrl)
                .then(res => res.json())
                .then(forecastData => ({historyData, forecastData}));
        })
        .then(({historyData, forecastData}) => {
            // calclate averages for each week
            const lastWeekMaxTemps = historyData.daily.temperature_2m_max;
            const lastWeekMinTemps = historyData.daily.temperature_2m_min;
            const lastWeekPrecip = historyData.daily.precipitation_sum;

            const thisWeekMaxTemps = forecastData.daily.temperature_2m_max.slice(0, 7);
            const thisWeekMinTemps = forecastData.daily.temperature_2m_min.slice(0, 7);
            const thisWeekPrecip = forecastData.daily.precipitation_sum.slice(0, 7);

            const avgLastWeekMax = lastWeekMaxTemps.reduce((a, b) => a + b, 0) / lastWeekMaxTemps.length;
            const avgLastWeekMin = lastWeekMinTemps.reduce((a, b) => a + b, 0) / lastWeekMinTemps.length;
            const avgThisWeekMax = thisWeekMaxTemps.reduce((a, b) => a + b, 0) / thisWeekMaxTemps.length;
            const avgThisWeekMin = thisWeekMinTemps.reduce((a, b) => a + b, 0) / thisWeekMinTemps.length;

            const sumLastWeekPrecip = lastWeekPrecip.reduce((a, b) => a + b, 0);
            const sumThisWeekPrecip = thisWeekPrecip.reduce((a, b) => a + b, 0);

            const tempDiff = ((avgThisWeekMax + avgThisWeekMin) / 2) - ((avgLastWeekMax + avgLastWeekMin) / 2);
            const precipDiff = sumThisWeekPrecip - sumLastWeekPrecip;

            let trendMessage = "";
            let trendClass = "trend-message";

            // Different thresholds based on units
            const tempThreshold = isMetric ? 1 : 1.8;
            const precipThreshold = isMetric ? 1: 0.04;

            // temperature trend
            if (Math.abs(tempDiff) < tempThreshold) {
                trendMessage = "This week's temperature will be similar to last week.";
            } else if (tempDiff > 0) {
                trendMessage = `This week will be ${tempDiff.toFixed(1)}° warmer than last week.`;
                trendClass += " trend-warmer";
            } else {
                trendMessage = `This week will be ${Math.abs(tempDiff).toFixed(1)}° cooler than last week.`;
                trendClass += " trend-cooler";
            }

            // precipitation trend
            if (Math.abs(precipDiff) < precipThreshold) {
                trendMessage += " Expect similar amounts of precipitation.";
            } else if (precipDiff > 0) {
                const unit = isMetric ? "mm" : "in";
                trendMessage += ` Expect ${precipDiff.toFixed(1)}${unit} more precipitation.`;
                trendClass += " trend-wetter";
            } else if (sumThisWeekPrecip < precipThreshold && sumLastWeekPrecip > precipThreshold * 5) {
                trendMessage += " This week will be much drier than last week.";
                trendClass += " trend-drier";
            } else if (precipDiff < 0) {
                const unit = isMetric ? "mm" : "in";
                trendMessage += ` Expect ${Math.abs(precipDiff).toFixed(1)}${unit} less precipitation.`;
                trendClass += " trend-drier";
            }

            weeklyTrendElement.textContent = trendMessage;
            weeklyTrendElement.className = trendClass;
        })
        .catch(err => {
            console.error("Error fetching weekly trends:", err);
            weeklyTrendElement.textContent = "Weekly comparison not available";
            weeklyTrendElement.className = "trend-message";
        });
}

// Weather background functionality

function setWeatherBackground(weatherCode, isNight) {
    document.body.classList.remove('night-background', 'rain-background', 'snow-background', 'storm-background')

    const effectsContainer = document.querySelector('.weather-background-effects');

    if (!effectsContainer) {
        console.warn("Weather background effects container not found");
        return;
    }

    effectsContainer.innerHTML = '';

    if (isNight) {
        document.body.classList.add('night-background');

        const starCount = 250;

        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            const left = Math.random() * 100;
            const top = Math.random() * 100;

            const size = 2 + Math.random() * 3;

            const twinkleDuration = 3 + Math.random() * 7 + 's';
            const twinkleDelay = Math.random() * 10 + 's';

            star.style.left = `${left}%`;
            star.style.top = `${top}%`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.animationDuration = twinkleDuration;
            star.style.animationDelay = twinkleDelay;

            if (Math.random() < 0.05) {
                star.classList.add('star-bright');
            }

            effectsContainer.appendChild(star);
        }
    }

    // Rain effect
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(weatherCode)) {
        document.body.classList.add('rain-background');

        const density = [51, 53, 56].includes(weatherCode) ? 20 : 70

        for (let i = 0; i < density; i++) {
            const drop = document.createElement('div');
            drop.classList.add('rain-drop');

            const left = Math.random() * 100;
            const duration = 0.5 + Math.random() * 0.7;
            const delay = Math.random() * 5;

            drop.style.left = `${left}%`;
            drop.style.animationDuration = `${duration}s`;
            drop.style.animationDelay = `${delay}s`;

            effectsContainer.appendChild(drop);
        }
    }

    // Snow effect
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
        document.body.classList.add('snow-background');

        const density = 50;

        for (let i = 0; i < density; i++) {
            const flake = document.createElement('div');
            flake.classList.add('snow-flake');

            const left = Math.random() * 100;
            const size = 2 + Math.random() * 4;
            const duration = 5 + Math.random() * 10;
            const delay = Math.random() * 5;
            const opacity = 0.3 + Math.random() * 0.7;

            flake.style.left = `${left}%`;
            flake.style.width = `${size}px`;
            flake.style.height = `${size}px`;
            flake.style.opacity = opacity;
            flake.style.animationDuration = `${duration}s`;
            flake.style.animationDelay = `${delay}s`;

            effectsContainer.appendChild(flake);
        }
    }

    // Storm effect
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(weatherCode)) {
        document.body.classList.add('rain-background');
        document.body.classList.add('storm-background');

        const density = 100;
        
        for (let i = 0; i < density; i++) {
            const drop = document.createElement('div');
            drop.classList.add('rain-drop');

            const left = Math.random() * 100;
            const duration = 0.3 + Math.random() * 0.5;
            const delay = Math.random() * 3;

            drop.style.left = `${left}%`;
            drop.style.animationDuration = `${duration}s`;
            drop.style.animationDelay = `${delay}s`;

            effectsContainer.appendChild(drop);
        }
    }
}

// Comparison functionality


function setupComparisonFeature() {
    const compareButton = document.getElementById('compare-toggle');
    const comparisonSection = document.getElementById('weather-comparison');

    compareButton.addEventListener('click', () => {
        comparisonSection.scrollIntoView({behavior: 'smooth'});
    });

    setupComparisonSearch('comparison-location-1', 'comparison-suggestions', 'comparison-results-1');
    setupComparisonSearch('comparison-location-2', 'comparison-suggestions', 'comparison-results-2');
}

function setupComparisonSearch(inputName, suggestionsClass, resultsId) {
    const searchInput = document.querySelector(`input[name="${inputName}"]`);
    const suggestionsContainers = document.getElementsByClassName(suggestionsClass);
    const resultsContainer = document.getElementById(resultsId);
    let searchTimeout = null;

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        const suggestionsContainer = this.closest('.comparison-search-container').querySelector('.comparison-suggestions');
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
        if (!query || query.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`)
            .then(res => res.json())
            .then(data => {
            suggestionsContainer.innerHTML = '';
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(city => {
                const displayName = city.country === city.name ? city.name : `${city.name}, ${city.country}`;
                const countryCode = city.country_code?.toUpperCase() || '';


                const suggestion = document.createElement('div');
                suggestion.classList.add('suggestion-item');

                suggestion.innerHTML = `
                    ${countryCode ? `<img class="country-flag" src="https://flagsapi.com/${countryCode}/flat/32.png" alt="${city.country}" flag">` : ''}
                    <span>${displayName}</span>
                `;

                suggestion.addEventListener('click', () => {
                    fetchComparisonWeather(city.latitude, city.longitude, city.name, city.country, resultsId);
                    searchInput.value = displayName;
                    suggestionsContainer.style.display = 'none';
                });
                
                suggestionsContainer.appendChild(suggestion);
                });
                
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.innerHTML = `
                <div class="no-results">
                    <img src="assets/images/icon-error.svg" alt="No results found" />
                    <div class="no-results-title">No results found</div>
                    <div class="no-results-message">
                    Try searching for a different city.
                    </div>
                </div>
                `;
                suggestionsContainer.style.display = 'block';
                
                resultsContainer.innerHTML = `
                <div class="comparison-no-results">
                    <img src="assets/images/icon-error.svg" alt="No results" />
                    <div>No search results found!</div>
                </div>
                `;
            }
            })
            .catch(err => {
            console.error('Error fetching city suggestions:', err);
            suggestionsContainer.style.display = 'none';

            resultsContainer.innerHTML = `
                <div class="comparison-no-results">
                <img src="assets/images/icon-error.svg" alt="Error" />
                <div>Something went wrong. Please try again.</div>
                </div>
            `;
            });
        }, 300);
    });

  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !Array.from(suggestionsContainers).some(container => container.contains(e.target))) {
        Array.from(suggestionsContainers).forEach(container => {
            container.style.display = 'none';
        });
    }
  });
}

function fetchComparisonWeather(latitude, longitude, cityName = '', countryName = '', resultsId) {
  const resultsContainer = document.getElementById(resultsId);
  resultsContainer.innerHTML = '<div class="comparison-loading">Loading weather data...</div>';
  
  // Open-Meteo API endpoint
  const unitParams = isMetric ? '' : '&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weathercode,windspeed_10m,visibility,pressure_msl,uv_index,dewpoint_2m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto${unitParams}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const current = data.current_weather;
      
      const today = new Date();
      const options = {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'};
      const dateString = today.toLocaleDateString(undefined, options);
      
      // Get hourly data arrays and time index for current hour
      const hourly = data.hourly;
      const currentHourIndex = findClosestHourIndex(hourly.time, current.time);
      
      // Icon mapping (reusing your existing mapping function)
      const iconMap = Object.assign(
        ...[
          [[0], 'icon-sunny.webp'],
          [[1, 2], 'icon-partly-cloudy.webp'],
          [[3], 'icon-overcast.webp'],
          [[45, 48], 'icon-fog.webp'],
          [[51, 53, 55, 56, 57], 'icon-drizzle.webp'],
          [[61, 63, 65, 66, 67], 'icon-rain.webp'],
          [[71, 73, 75, 77, 85, 86], 'icon-snow.webp'],
          [[80, 81, 82, 95, 96, 99], 'icon-storm.webp']
        ].map(([codes, icon]) => 
          Object.fromEntries(codes.map(code => [code, icon]))
        )
      );
      
      const weatherCode = current.weathercode;
      const iconFile = iconMap[weatherCode] || 'icon-sunny.webp';
      
      const locationText = cityName ? (countryName && cityName !== countryName ? `${cityName}, ${countryName}` : cityName) : 'Unknown location';
      
      const tempCurrent = Math.round(current.temperature);
      const feelsLike = Math.round(hourly.apparent_temperature[currentHourIndex]);
      const tempMin = Math.round(data.daily.temperature_2m_min[0]);
      const tempMax = Math.round(data.daily.temperature_2m_max[0]);
      const humidity = Math.round(hourly.relative_humidity_2m[currentHourIndex]);
      const windSpeed = Math.round(current.windspeed);
      const uvIndex = hourly.uv_index ? hourly.uv_index[currentHourIndex] : undefined;
      const visibility = hourly.visibility ? hourly.visibility[currentHourIndex] : undefined;

      // Create comparison card
      resultsContainer.innerHTML = `
        <div class="comparison-card">
          <div class="comparison-header-info">
            <h4 class="comparison-location">${locationText}</h4>
            <p class="comparison-date">${dateString}</p>
          </div>
          
          <div class="comparison-temp-section">
            <div class="comparison-main">
              <img src="assets/images/${iconFile}" alt="" class="comparison-icon">
              <span class="comparison-temp">${tempCurrent}°</span>
            </div>
            
            <div class="comparison-temp-details">
              <div class="comparison-feels-like">
                <span class="feels-like-label">Feels Like</span>
                <span class="feels-like-value">${feelsLike}°</span>
              </div>
              <div class="comparison-min-max">
                <span class="min-max-label">Min/Max</span>
                <span class="min-max-value">${tempMin}° / ${tempMax}°</span>
              </div>
            </div>
          </div>
          
          <div class="comparison-metrics">
            <div class="comparison-metric">
              <span class="metric-label">Humidity</span>
              <span class="metric-value" data-metric="humidity">${humidity}%</span>
            </div>
            <div class="comparison-metric">
              <span class="metric-label">Wind Speed</span>
              <span class="metric-value" data-metric="wind">${windSpeed} ${isWindMetric ? 'km/h' : 'mph'}</span>
            </div>
            <div class="comparison-metric">
              <span class="metric-label">UV Index</span>
              <span class="metric-value" data-metric="uv">${getUvDescription(uvIndex)}</span>
            </div>
            <div class="comparison-metric">
              <span class="metric-label">Visibility</span>
              <span class="metric-value" data-metric="visibility">${formatVisibility(visibility)}</span>
            </div>
          </div>
        </div>
      `;
      
      compareMetrics();
    })
    .catch(err => {
      console.error('Weather API error:', err);
      resultsContainer.innerHTML = '<div class="comparison-error">Error loading weather data</div>';
    });
}

function getUvDescription(uvIndex) {
  if (!uvIndex) return '--';
  const uv = Math.round(uvIndex);
  if (uv < 3) return `${uv} (Low)`;
  if (uv < 6) return `${uv} (Mod)`;
  if (uv < 8) return `${uv} (High)`;
  if (uv < 11) return `${uv} (V.High)`;
  return `${uv} (Extreme)`;
}

function formatVisibility(visibility) {
  if (!visibility) return '--';
  const convertedVisibility = isMetric ? visibility / 1000 : visibility / 1609;
  return `${Math.round(convertedVisibility)} ${isMetric ? 'km' : 'mi'}`;
}

function compareMetrics() {
  const results1 = document.getElementById('comparison-results-1');
  const results2 = document.getElementById('comparison-results-2');
  
  if (!results1.querySelector('.comparison-card') || !results2.querySelector('.comparison-card')) {
    return;
  }
  
  compareTemperature(
    results1.querySelector('.comparison-temp'),
    results2.querySelector('.comparison-temp')
  );
  
  compareTemperature(
    results1.querySelector('.feels-like-value'),
    results2.querySelector('.feels-like-value')
  );
    
  const metrics = ['humidity', 'wind', 'uv', 'visibility'];
  
  metrics.forEach(metric => {
    const value1 = results1.querySelector(`[data-metric="${metric}"]`);
    const value2 = results2.querySelector(`[data-metric="${metric}"]`);
    
    if (!value1 || !value2) return;
    
    const num1 = extractNumericValue(value1.textContent);
    const num2 = extractNumericValue(value2.textContent);
    
    if (num1 !== null && num2 !== null) {
      switch(metric) {
        case 'humidity':
          if (num1 < num2) {
            value1.classList.add('metric-better');
            value2.classList.add('metric-worse');
          } else if (num1 > num2) {
            value1.classList.add('metric-worse');
            value2.classList.add('metric-better');
          }
          break;
          
        case 'wind':
          if (num1 < num2) {
            value1.classList.add('metric-better');
            value2.classList.add('metric-worse');
          } else if (num1 > num2) {
            value1.classList.add('metric-worse');
            value2.classList.add('metric-better');
          }
          break;
          
        case 'uv':
          if (num1 < num2) {
            value1.classList.add('metric-better');
            value2.classList.add('metric-worse');
          } else if (num1 > num2) {
            value1.classList.add('metric-worse');
            value2.classList.add('metric-better');
          }
          break;
          
        case 'visibility':
          if (num1 > num2) {
            value1.classList.add('metric-better');
            value2.classList.add('metric-worse');
          } else if (num1 < num2) {
            value1.classList.add('metric-worse');
            value2.classList.add('metric-better');
          }
          break;
      }
    }
  });
}

function extractNumericValue(text) {
  const match = text.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : null;
}

function compareTemperature(temp1, temp2) {
  if (!temp1 || !temp2) return;
  
  const value1 = extractNumericValue(temp1.textContent);
  const value2 = extractNumericValue(temp2.textContent);
  
  if (value1 !== null && value2 !== null) {
    const ideal = isMetric ? [20, 25] : [68, 77];
    
    const temp1Ideal = value1 >= ideal[0] && value1 <= ideal[1];
    const temp2Ideal = value2 >= ideal[0] && value2 <= ideal[1];
    
    if (temp1Ideal && !temp2Ideal) {
      temp1.classList.add('metric-better');
      temp2.classList.add('metric-worse');
    } else if (!temp1Ideal && temp2Ideal) {
      temp1.classList.add('metric-worse');
      temp2.classList.add('metric-better');
    }
  }
}

// Radar map functionality

function openRadarModal() {
    const radarModal = document.getElementById('radar-modal');
    radarModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const favIcon = document.querySelector('.favourite-icon');
    if (favIcon && favIcon.dataset.lat && favIcon.dataset.lon) {
            currentLat = parseFloat(favIcon.dataset.lat);
            currentLon = parseFloat(favIcon.dataset.lon);
    }

    const locationTimezone = document.querySelector('.favourite-icon').dataset.timezone;

    loadLeafletIfNeeded().then(() => {
        initializeRadarMap(locationTimezone);
    });
}

function closeRadarModal() {
    const radarModal = document.getElementById('radar-modal');
    radarModal.classList.remove('active');
    document.body.style.overflow = '';

    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
}

function loadLeafletIfNeeded() {
    return new Promise((resolve) => {
        if (leafletLoaded) {
            resolve();
            return;
        }

        // Load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        leafletCSS.crossOrigin = '';
        document.head.appendChild(leafletCSS);
        
        // Load Leaflet JS
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        leafletScript.crossOrigin = '';
        
        leafletScript.onload = function() {
            leafletLoaded = true;
            resolve();
        };
        
        document.body.appendChild(leafletScript);
    });
}

function initializeRadarMap() {
    if (radarMap) {
        radarMap.setView([currentLat, currentLon], 8);
        if (locationMarker) {
            radarMap.removeLayer(locationMarker);
        }
        locationMarker = L.marker([currentLat, currentLon]).addTo(radarMap);
        radarMap.invalidateSize();
        loadRadarData();
        return;
    }

    if (!currentLat || !currentLon) {
        // default to a location if current location not available
        currentLat = 40.7128;
        currentLon = -74.0060;
    }

    // Initialize the map
    radarMap = L.map('radar-map', {
        center: [currentLat, currentLon],
        zoom: 8,
        zoomControl: true,
        attributionControl: true
    });

    const isDarkTheme = !document.body.classList.contains('light-theme');

    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + 
        (isDarkTheme ? 'dark_all' : 'light_all') + 
        '/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    }).addTo(radarMap);

    locationMarker = L.marker([currentLat, currentLon]).addTo(radarMap);

    loadRadarData();
    
    setupTimelineControls();
    
    setTimeout(() => {
        radarMap.invalidateSize();
    }, 100);
}

function loadRadarData() {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then (data => {
            radarData = data;
            currentFrameIndex = data.radar.past.length - 1;

            const slider = document.getElementById('radar-time-slider');
            slider.max = data.radar.past.length + data.radar.nowcast.length - 1;
            slider.value = data.radar.past.length - 1;

            showRadarFrame(currentFrameIndex);

            updateTimeLabel(currentFrameIndex);
        })
        .catch(err => {
            console.error('Error loading radar data:', err);
        });
}

function showRadarFrame(frameIndex) {
    if (!radarData || !radarMap) return;

    if (radarLayer) {
        radarMap.removeLayer(radarLayer);
    }

    let path;
    const pastFramesCount = radarData.radar.past.length;

    if (frameIndex < pastFramesCount) {
        path = radarData.radar.past[frameIndex].path;
    } else {
        path = radarData.radar.nowcast[frameIndex - pastFramesCount].path;
    }

    radarLayer = L.tileLayer(
        'https://tilecache.rainviewer.com' + path + '/256/{z}/{x}/{y}/8/1_1.png', {
            tileSize: 256,
            opacity: 0.7,
            zIndex: 5
        }
    ).addTo(radarMap);
    updateTimeLabel(frameIndex);
}

function updateTimeLabel(frameIndex) {
    if (!radarData) return;

    const timeLabel = document.querySelector('.radar-time-label');
    const pastFramesCount = radarData.radar.past.length;

    let timestamp;
    let isForecast = false;

    if (frameIndex < pastFramesCount) {
        timestamp = radarData.radar.past[frameIndex].time;
    } else {
        timestamp = radarData.radar.nowcast[frameIndex - pastFramesCount].time;
        isForecast = true;
    }

    const date = new Date(timestamp * 1000);
    const timeStr = formatDateForTimezone(date, locationTimezone || 'auto', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });

    timeLabel.textContent = isForecast ? `${timeStr} (Forecast)` : timeStr;
}

function setupTimelineControls() {
  const slider = document.getElementById('radar-time-slider');
  const playPauseButton = document.getElementById('radar-play-pause');
  let isPlaying = false;
  
  slider.addEventListener('input', function() {
    currentFrameIndex = parseInt(this.value);
    showRadarFrame(currentFrameIndex);
    
    // Stop animation if it was playing
    if (isPlaying) {
      togglePlayPause();
    }
  });
  
  playPauseButton.addEventListener('click', function() {
    togglePlayPause();
  });
  
  function togglePlayPause() {
    isPlaying = !isPlaying;
    
    if (isPlaying) {
      playPauseButton.querySelector('img').src = 'assets/images/icon-pause.webp';
      
      animationInterval = setInterval(() => {
        if (!radarData) return;
        
        const maxFrames = radarData.radar.past.length + radarData.radar.nowcast.length - 1;
        
        currentFrameIndex = (currentFrameIndex + 1) % (maxFrames + 1);
        showRadarFrame(currentFrameIndex);
        
        slider.value = currentFrameIndex;
      }, 500);
    } else {
      playPauseButton.querySelector('img').src = 'assets/images/icon-play.webp';
      
      if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
      }
    }
  }
}

function updateMapTilesForTheme() {
    if (radarMap) {
        radarMap.eachLayer(function(layer) {
            if (layer instanceof L.TileLayer) {
                radarMap.removeLayer(layer);
            }
        });
        
        const isDarkTheme = !document.body.classList.contains('light-theme');
        L.tileLayer('https://{s}.basemaps.cartocdn.com/' + 
            (isDarkTheme ? 'dark_all' : 'light_all') + 
            '/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19
        }).addTo(radarMap);
        
        if (locationMarker) {
            locationMarker.bringToFront();
        }
    }
}

function formatDateForTimezone(date, timezone, options) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone
    }).format(date);
  } catch (error) {
    // Fallback to local timezone if there's an error with the provided timezone
    console.warn('Error formatting date for timezone:', error);
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

// Initialize all UI controls and their event handlers
function initializeUIControls() {
    // Units dropdown functionality
    initializeUnitsControl();

    // Close search suggestions when clicking elsewhere
    document.addEventListener('click', function(e) {
        const searchInput = document.querySelector('input[name="location"]');
        const suggestionsContainer = document.querySelector('.search-suggestions');
        
        if (searchInput && suggestionsContainer && 
            !searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Theme toggle
    setupThemeToggle();

    // Favourites toggle
    setupFavouritesToggle();
}

// Initialize units dropdown and toggle functionality
function initializeUnitsControl() {
    // Set up unit toggle button
    const switchButton = document.querySelector('.dropdown-section:first-child .dropdown-switch');
    if (switchButton) {
        switchButton.addEventListener('click', toggleUnits);
    }

    // Toggle dropdown visibility
    const unitsButton = document.getElementById('units-btn')
    unitsButton.addEventListener('click', function(e) {
        e.stopPropagation();
        const dropdown = document.querySelector('.dropdown-menu');
        dropdown.classList.toggle('show');

        this.classList.toggle('active');
    });

    document.querySelectorAll('.dropdown-section:not(:first-child) .dropdown-label').forEach(label => {
        label.style.cursor = 'pointer';
        label.addEventListener('click', function() {
            const section = this.closest('.dropdown-section');
            const labels = section.querySelectorAll('.dropdown-label');

            if (this.classList.contains('active')) return;

            labels.forEach(lbl => lbl.classList.remove('active'));
            this.classList.add('active');

            const tempLabels = document.querySelectorAll('.dropdown-section:nth-child(2) .dropdown-label');
            const windLabels = document.querySelectorAll('.dropdown-section:nth-child(3) .dropdown-label');
            const precipLabels = document.querySelectorAll('.dropdown-section:nth-child(4) .dropdown-label');

            isTempMetric = tempLabels[0].classList.contains('active');
            isWindMetric = windLabels[0].classList.contains('active');
            isPrecipMetric = precipLabels[0].classList.contains('active');

            isMetric = isTempMetric && isWindMetric && isPrecipMetric;

            const switchButton = document.querySelector('.dropdown-section:first-child .dropdown-switch');
            switchButton.textContent = isMetric ? 'Switch to Imperial' : 'Switch to Metric';

            // Refresh weather with updated units

            if (isCurrentLocationShown && currentLat !== null && currentLon !== null) {
                fetchWeather(currentLat, currentLon, '', '', true);
            } else {
                const weatherLocation = document.getElementById('weather-location').textContent;
                if (weatherLocation) {
                    const locationParts = weatherLocation.split(',');
                    const cityName = locationParts[0].trim();
                    const countryName = locationParts.length > 1 ? locationParts[1].trim() : cityName;
        
                    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`)
                        .then(res => res.json())
                        .then(geoData => {
                            if (geoData.results && geoData.results.length > 0) {
                                const result = geoData.results[0];
                                fetchWeather(result.latitude, result.longitude, result.name, result.country);
                            }
                        });
                } else {
                    fetchWeather(35.68, 139.65, 'Tokyo', 'Japan');
                }
            }

            document.querySelectorAll('.comparison-card').forEach(card => {
                const resultId = card.closest('[id^="comparison-results"]').id;
                const inputName = resultId === 'comparison-results-1' ? 'comparison-location-1' : 'comparison-location-2';
                const inputValue = document.querySelector(`input[name="${inputName}"]`).value;

                if (inputValue) {
                    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputValue)}&count=1`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.results && data.results.length > 0) {
                                const result = data.results[0];
                                fetchComparisonWeather(result.latitude, result.longitude, result.name, result.country, resultId);
                            }
                        });
                }
            })
        });
    });

    document.addEventListener('click', function(event) {
        const dropdown = document.querySelector('.dropdown-menu');
        const unitsButton = document.getElementById('units-btn');

        if (dropdown.classList.contains('show') && !dropdown.contains(event.target) && !unitsButton.contains(event.target)) {
            dropdown.classList.remove('show');
            unitsButton.classList.remove('active');
        }
    })
}

// Setup favourite toggle functionality
function setupFavouritesToggle() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('favourite-icon') || e.target.parentElement.classList.contains('favourite-icon')) {
            const icon = e.target.classList.contains('favourite-icon') ? e.target : e.target.parentElement;
            let locationName, countryName = '';

            icon.classList.add('animate');

            setTimeout(() => {
                icon.classList.remove('animate');
            }, 400);
            
            if (icon.dataset.location === 'Current Location') {
                locationName = 'Current Location';
            } else if (icon.dataset.location.includes(',')) {
                const parts = icon.dataset.location.split(',');
                locationName = parts[0].trim();
                countryName = parts[1].trim();
            } else {
                locationName = icon.dataset.location.trim();
            }
            
            toggleFavourite(locationName, parseFloat(icon.dataset.lat), parseFloat(icon.dataset.lon), countryName);
        }
    });
}

// Get user's geolocation if available
function loadUserLocation() {
    if (navigator.geolocation) {
        toggleLoading(true);

        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchWeather(lat, lon, '', '', true);
            },
            (error) => {
                console.log('Geolocation error or denied:', error.message);
                fetchWeather(35.68, 139.65, 'Tokyo', 'Japan')
            },
            { timeout: 6000 , maximumAge: 0}
        );
    } else {
        fetchWeather(35.68, 139.65, 'Tokyo', 'Japan');
    }
}

// Setup radar feature and modal controls
function setupRadarFeature() {
    const radarButton = document.getElementById('radar-button');
    const radarModal = document.getElementById('radar-modal');
    const closeButton = document.querySelector('.radar-close-button');

    if (radarButton && radarModal && closeButton) {
        radarButton.addEventListener('click', openRadarModal);
        closeButton.addEventListener('click', closeRadarModal);

        radarModal.addEventListener('click', function(e) {
            if (e.target === radarModal) {
                closeRadarModal();
            }
        });
    }
}

// Animate numbers
function animateValue(element, start, end, duration) {
    if (start === end) return;

    const unit = element.textContent.replace(/[0-9]/g, '');
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(start + (end - start) * easedProgress);
        
        element.textContent = `${currentValue}${unit}`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

function animateWeatherValues() {
    const tempElement = document.getElementById('weather-temperature').querySelector('i');
    const currentTemp = parseInt(tempElement.textContent);
    tempElement.textContent = `0°`;
    animateValue(tempElement, 0, currentTemp, 1000);

    const metrics = [
        'weather-feelslike',
        'weather-humidity',
        'weather-wind',
        'weather-uv'
    ];

    metrics.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;

        const value = parseInt(element.textContent);
        if (!isNaN(value)) {
            const unit = element.textContent.replace(/[0-9]/g, '');
            element.textContent = `0${unit}`;
            animateValue(element, 0, value, 800);
        }
    });
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements and event handlers
    initializeUIControls();

    // Load initial data
    loadUserLocation();
    loadFavourites();

    // Setup features
    setupWeatherDetailsNavigation();
    setupComparisonFeature();
    setupRadarFeature();
});
