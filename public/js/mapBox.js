/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiYW5raXRhZ25pMjMiLCJhIjoiY2xnZG9nNW9yMXgyYTN4cGk5ZmtydWx6NSJ9.4CrkXYahG5Qw_6HeZGI0aQ';

  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/ankitagni23/clgdp4va3001t01l78wbfwtci',
    scrollZoom: false,
    //   center: [-118.113491, 34.111745],
    //   zoom: 4,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create Marker
    const el = document.createElement('div');
    el.className = 'marker';

    //Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    new mapboxgl.Popup({ offset: 30 })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day} : ${loc.description}</p>`)
      .addTo(map);
    //Extends map bounds
    bounds.extend(loc.coordinates);
  });
  map.fitBounds(bounds, {
    padding: { top: 200, bottom: 150, left: 100, right: 100 },
  });
};
