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


const preferencesSubmit = document.getElementById('preferences-submit');
preferencesSubmit.addEventListener("click", (event) => {
  event.preventDefault();
  let cuisine  = document.getElementById("cuisine");
  let price    = document.getElementById("price");
  let city     = document.getElementById("location");
  let radius   = document.getElementById("radius");

  // Prevent form submission if the button is inside a form
  const url = `/sendYelp?cuisine=${cuisine.value}&price=${price.value}&city=${city.value}&radius=${radius.value}&roomID=${roomId}`;

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
  const name = business[arrIndex][0];
  socket.emit("deleteRestaurant", { restaurant : name })
};

// Socket event to populate nominations for all users
socket.on("nominations", (data) => {
  businesses = data.resturantData;
  business = [];
  const middleColumn = document.getElementById("middleColumn");

  businesses.forEach((item) => {
    business.push([
      item.name,
      item.price,
      item.rating,
      item.location,
      item.phone
    ]);
  });

  middleColumn.innerHTML = `
    <h2>Nominations</h2>
    <h3>Nominate a Restaurant</h3>
    <form id="restaurant-form">
      <input type="text" id="res-address" placeholder="Type restaurant address" />
      <button type="submit">Add Restaurant</button>
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
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  `;

  renderTable();
  initAutocomplete();
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
  console.log(place);

  const rowData = {name: place.name, 
                   price: priceMapping[place.price_level], 
                   rating: place.rating, 
                   location: place.formatted_address,
                   phone: place.formatted_phone_number,
                   picture: place.photos[0]};
  socket.emit("addRestaurant", { restaurant : rowData })
};

async function loadGoogleMaps() {
  try {
    const response = await fetch("/getGoogleApiKey");
    const data = await response.json();
    const apiKey = data.key;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=initAutocomplete`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  } catch (error) {
    console.error("Error loading Google Maps API:", error);
  }
}

loadGoogleMaps();