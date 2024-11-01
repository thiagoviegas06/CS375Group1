const url = "localhost:3000";
const sendButton = document.getElementById("sendButton");
const userField = document.getElementById("nameField");
const passField = document.getElementById("passField");

const sendInfo = async () => {
    const userName = userField.value;
    const password = passField.value;
    const data = { userField: userName, password: password };
    fetch(url, {
        method: 'POST', // Specify the request method
        headers: {
          'Content-Type': 'application/json' // Set the content type to JSON
        },
        body: JSON.stringify(data) // Convert the data to a JSON string
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json(); // Parse the JSON from the response
      })
      .then(data => {
        console.log('Success:', data); // Handle the response data
      })
      .catch(error => {
        console.error('Error:', error); // Handle any errors
      });
};

sendButton.addEventListener("click", sendInfo);