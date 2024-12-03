let autocomplete;
let userLocation = [];
function initAutocomplete() {
    address1Field = document.querySelector("#res-address");
    const googleMapAutoOption = {
        componentRestrictions: { country: ["us"] },
        fields: ["geometry"],
        types: [],
    };
    autocomplete = new google.maps.places.Autocomplete(address1Field, googleMapAutoOption);
    address1Field.focus();
    autocomplete.addListener("place_changed", setUserLocation);
};

function setUserLocation() {
    const place = autocomplete.getPlace();
    userLocation.push(place.geometry.location.lat());
    userLocation.push(place.geometry.location.lng());
    console.log(userLocation);
}

/*NOTE
Script need google API
  <script
    src="https://maps.googleapis.com/maps/api/js?key=&libraries=places&v=weekly&callback=initAutocomplete"
    defer async>
    </script>
 */

