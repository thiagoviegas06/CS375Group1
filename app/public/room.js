function detectPageRefresh() {
  let navigationType;

  if (performance.getEntriesByType('navigation').length > 0) {
    navigationType = performance.getEntriesByType('navigation')[0].type;
  } else {
    navigationType = performance.navigation.type;
    if (navigationType === 1) {
      navigationType = 'reload';
    } else {
      navigationType = 'navigate';
    }
  }

  if (navigationType === 'reload') {

    window.location.href = '/';
  }
}
detectPageRefresh();

window.addEventListener('beforeunload', () => {
  socket.disconnect();
});

let map = null;
let socket = io();
let usersList = document.getElementById("usersList");
let startVoteButton = document.getElementById("startVote");
let button = document.getElementById("send");
let input = document.getElementById("input");
let messagesDiv = document.getElementById("messages");
let preferencesDiv = document.getElementById("host-preferences");
let clientUsername = null;

function appendMessage(data) {
  let item = document.createElement("div");
  item.textContent = `${data.username}: ${data.message}`;
  messagesDiv.appendChild(item);
}

button.addEventListener("click", () => {
  let message = input.value;
  if (message === "") {
    return;
  }
  console.log("Sending message:", message);
  socket.emit("foo", { message });
  input.value = "";
  appendMessage({ username: clientUsername, message: message });
});

socket.on("bar", function (data) {
  console.log("Received message:", data.message);
  appendMessage(data);
});

fetch('/get-username')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      clientUsername = data.username;
    }
  });

let pathParts = window.location.pathname.split("/");
let roomId = pathParts[pathParts.length - 1];

let roomURL = `/getRoomObj/?id=${roomId}`;
let roomObj = {};

function getRoomFromServer(){
  fetch(roomURL)
  .then((response) => {
    return response.json(); // Parse JSON response
  })
  .then((body) => {
    roomObj = body;
    console.log(body); // Assign the response body to roomObj
  })
  .catch((error) => {
    console.log(error); // Log errors, if any
  });
}


socket.emit('joinRoom', { "roomId": roomId });

socket.on('updateUserList', (userList) => {
  usersList.innerHTML = '';

  userList.forEach(user => {
    let listItem = document.createElement('li');
    listItem.textContent = user.username + (user.isPartyLeader ? ' (Leader)' : '');
    usersList.appendChild(listItem);

    if (user.isPartyLeader && user.username === clientUsername) {
      startVoteButton.style.display = 'inline-block';
      preferencesDiv.style.display = 'inline-block';
    }
  });
});

startVoteButton.addEventListener("click", () => {
  socket.emit("startVoting", { roomId: roomId });
});

socket.on('startVoting', (data) => {
  getRoomFromServer(); 
  
  const userLocations = data.userLocations;
  const leaderLocation = data.leaderLocation;
  
  const restaurants = data.restaurants;
  let currentIndex = 0;
  let userVotes = {};
  let submittedVote = false;

  function displayRestaurant(index) {
    socket.emit("submitCurrentVotes", { votes: userVotes })
    if (index >= restaurants.length && !submittedVote) {
      socket.emit('submitVotes', { votes: userVotes });
      document.getElementById('votingSection').innerHTML = "<p>Voting completed. Thank you!</p>";
      submittedVote = true;
      return;
    }
    const restaurant = restaurants[index];

    //Making sure the restaurant exists in the database
    fetch('/restaurant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ "restaurant": restaurant.name })
    });

    let votingSection = document.getElementById('votingSection');
    votingSection.innerHTML = '';

    let restaurantDiv = document.createElement('div');

    let nameElement = document.createElement('h2');
    nameElement.textContent = restaurant.name;

    let pictureElement = document.createElement('img');
    pictureElement.src = restaurant.picture;
    pictureElement.alt = restaurant.name;
    pictureElement.style.maxWidth = '400px';
    pictureElement.style.height = 'auto';
    const sliderDiv = document.createElement('div');
    sliderDiv.setAttribute("class", "slider_container");
    const mySlider = document.createElement('input');
    mySlider.setAttribute("type", "range");
    mySlider.setAttribute("min", "1");
    mySlider.setAttribute("max", "10");
    //mySlider.setAttribute("defaultValue", "5");
    mySlider.setAttribute("value", "5");
    mySlider.setAttribute("class", "slider");
    mySlider.setAttribute("id", "myRange");
    sliderDiv.appendChild(mySlider);
    const textTemplate = document.createElement("h2");
    textTemplate.textContent = "Score: ";
    const sliderInfo = document.createElement("h3");
    sliderInfo.textContent = mySlider.value;
    sliderDiv.appendChild(textTemplate);
    sliderDiv.appendChild(sliderInfo);

    mySlider.addEventListener("change", (event) => {
      sliderInfo.textContent = mySlider.value;
    })

    let yesButton = document.createElement('button');
    yesButton.textContent = 'Vote!';

    yesButton.addEventListener('click', () => {
      currentIndex++;
      userVotes[restaurant.name] = mySlider.value;

      //updating personal preference
      fetch('/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          {
            "restaurant": restaurant.name,
            "increment": userVotes[restaurant.name]
          }
        )
      });
      displayRestaurant(currentIndex);
    });

    restaurantDiv.appendChild(nameElement);
    restaurantDiv.appendChild(pictureElement);
    restaurantDiv.appendChild(document.createElement("br"));
    restaurantDiv.appendChild(sliderDiv);
    restaurantDiv.appendChild(document.createElement("br"));
    restaurantDiv.appendChild(yesButton);
    votingSection.appendChild(restaurantDiv);
  }

  displayRestaurant(currentIndex);
});

socket.on('votingResults', (data) => {
  const results = data.results;
  let resultsSection = document.getElementById('votingResults');
  resultsSection.innerHTML = '<h2>Voting Results</h2>';

  let resultsList = document.createElement('ul');

  for (const restaurant of Object.values(results)) {
    let listItem = document.createElement('li');
    listItem.textContent = `${restaurant.name}: ${restaurant.score}`;
    resultsList.appendChild(listItem);
  }

  resultsSection.appendChild(resultsList);
});

let rating_flag = false;
let selectRating = document.getElementById("ratingSelect");

document.getElementById("yesNoDropdown").addEventListener("change", function () {
  const ratingField = document.getElementById("ratingField");
  if (this.value === "yes") {
    ratingField.style.display = "block";
    rating_flag = true;
  } else {
    ratingField.style.display = "none";
    rating_flag = false;
  }
});



const preferencesSubmit = document.getElementById('preferences-submit');
preferencesSubmit.addEventListener("click", (event) => {
  event.preventDefault();
  let cuisine  = document.getElementById("cuisine");
  let price    = document.getElementById("price");
  let city     = document.getElementById("location");
  let radius   = document.getElementById("radius");

  let realRadius = radius.value * 1609.34;
  // hehe no negative allowed 
  if(realRadius > 40000 || realRadius < 0){
    realRadius = 40000;
  }

  let ratingVal = -10;

  if(rating_flag){
    ratingVal = selectRating.value;
  }

  // Prevent form submission if the button is inside a form
  const url = `/sendYelp?cuisine=${cuisine.value}&price=${price.value}&city=${city.value}&radius=${realRadius}&roomID=${roomId}&rating=${ratingVal}`;

  fetch(url)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  })
  .then((data) => {
    preferencesDiv.style.display = 'none';
  })
  .catch((error) => {
    console.error("Error fetching Yelp data:", error.message);
  });
});



let rowId = 1; // Unique identifier for rows
let business = []; // Placeholder for business data from the server

const renderTable = () => {
  const tbody = document.getElementById("tbody");

  // Clear existing table rows
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  // Populate table with new data
  business.forEach((row, idx) => {
    const newRow = document.createElement("tr");

    // Dynamically create and append cells
    const cell = document.createElement("td");
    cell.textContent = idx + 1;
    newRow.appendChild(cell);

    row.forEach((data) => {
      const cell = document.createElement("td");
      cell.textContent = data;
      newRow.appendChild(cell);
    });

    const removeCell = document.createElement("td");
    const newButton = document.createElement("button");
    newButton.textContent = "Delete";
    newButton.addEventListener("click", () => removeRow(idx));
    removeCell.appendChild(newButton);
    newRow.appendChild(removeCell);

    tbody.appendChild(newRow);
  });
};

function removeRow(arrIndex) {
  //const name = business[arrIndex][0];
  //removeCell(arrIndex);
  socket.emit("deleteRestaurant", { idx : arrIndex })
};

// Socket event to populate nominations for all users
socket.on("nominations", (data) => {
  businesses = data.restaurants;

  let leaderLocation = data.leaderLocation;

  let mapDiv = document.getElementById("map");
  
  business = [];
  const middleColumn = document.getElementById("middleColumn");
  //let map = initMap();
  map.setCenter({ lat: leaderLocation.lat, lng: leaderLocation.lon });
  mapDiv.style.display = "block";


  const coordinates = [];

  businesses.forEach((item) => {
    business.push([
      item.name,
      item.price,
      item.rating,
      item.location,
      item.phone
    ]);

    const mark = {
      position: { lat: item.coordinates.latitude, lng: item.coordinates.longitude },
      title: item.name,
    };

    //adding markers to coordinates list

    coordinates.push(mark); 

  });

  middleColumn.innerHTML = `
    <h2>Nominations</h2>
    <h3>Nominate a Restaurant</h3>
    <form id="restaurant-form">
      <input type="text" id="res-address" placeholder="Type restaurant address" />
    </form>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Price</th>
          <th>Rating</th>
          <th>Address</th>
          <th>Phone Number</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  `;

  renderTable();
  initAutocomplete();
  
  coordinates.forEach((coord) => {
    addMarker(coord, map);
  }); 
  /*
  initialize(leaderLocation);
  initMap(leaderLocation)
        .then((map) => {
            for (const coord of coordinates) {
                addMarker(coord, map); // Pass map to addMarker
            }
        })
        .catch((error) => console.error("Error initializing map or adding markers:", error));
        */
});


let autocomplete;
let address1Field;
const priceMapping = {
  0: "",
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$"
};

const initAutocomplete = () => {
  address1Field = document.getElementById("res-address")
  const googleMapAutoOption = {
      componentRestrictions: { country: ["us"] },
      fields: ["name", "formatted_address", "geometry", "rating", "price_level", "formatted_phone_number", "photos"],
      types: ["restaurant", "cafe"],
  };
  autocomplete = new google.maps.places.Autocomplete(address1Field, googleMapAutoOption);
  address1Field.focus();
  autocomplete.addListener("place_changed", fillInAddress);
};

const fillInAddress = () => {
  const place = autocomplete.getPlace();
  if (!place.geometry) {
      console.error("No geometry available for this place.");
      return;
  }

  const rowData = {name: place.name, 
                   price: priceMapping[place.price_level], 
                   rating: place.rating, 
                   location: place.formatted_address,
                   phone: place.formatted_phone_number,
                   picture: place.photos[0],
                   coordinates: {latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng()},
                   menu: ""
                  };
  socket.emit("addRestaurant", { restaurant : rowData });
  address1Field = document.getElementById("res-address").value = "";
};

socket.on('changedRestaurant', (data) => {
  newbusiness = []
  data.restaurants.map((restaurant) => {
    singleitem = [restaurant.name,
      restaurant.price,
      restaurant.rating,
      restaurant.location,
      restaurant.phone
    ]
    newbusiness.push(singleitem)
  })
  business = newbusiness;
  renderTable();
})

async function loadGoogleMaps() {
  try {
    const response = await fetch("/getGoogleApiKey");
    const data = await response.json();
    const apiKey = data.key;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=initialize`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  } catch (error) {
    console.error("Error loading Google Maps API:", error);
  }
}

async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  //const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
  

  const map = new Map(document.getElementById("map"), {
      center: { lat: 39.9526, lng: 75.16522 },
      zoom: 12,
      mapId: "6747d039df5a2bde",
  });

  addMarker({ lat: 39.9526, lng: -75.16522 })

  return map; // Return the map instance for further use
}


function addMarker(coord, map) {
  /*const pinGlyphYellow1 = new PinElement({
    background: "#FFFD55",
    borderColor: "#FFFD55"
  });*/
  const marker = new google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: coord.position,
      //content: pinGlyphYellow1
  });

  const infoWindow = new google.maps.InfoWindow({
      content: coord.title,
  });

  marker.element.addEventListener("click", function () {
      infoWindow.open(map, marker);
  });
}

function removeMarker(index) {
  if (index >= 0 && index < markersArray.length && markersArray[index]) {
      markersArray[index].setMap(null);
      markersArray.splice(index, 1);
  } else {
      console.error("Invalid marker index");
  }
}

async function initialize() {
  // Call both initializers within the single callback
      map = await (initMap());
      initAutocomplete();
  }
 


loadGoogleMaps();