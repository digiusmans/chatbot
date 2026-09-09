// State management for chat history
let conversationHistory = [
  { role: "system", content: "You are a helpful assistant." }
];

// DOM Element References
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

/**
 * Appends a new message bubble to the chat container
 * @param {string} message - Text content to render
 * @param {string} role - Message sender class ('user', 'aibot', or 'error')
 * @param {string} imgSrc - Relative image URL for the avatar
 */
const addMessage = (message, role, imgSrc) => {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${role}`;

  const imgElement = document.createElement('img');
  imgElement.src = imgSrc;
  imgElement.alt = `${role} avatar`;
  imgElement.onerror = () => imgElement.remove();

  const textElement = document.createElement('p');
  textElement.innerText = message;

  messageElement.appendChild(imgElement);
  messageElement.appendChild(textElement);
  messagesContainer.appendChild(messageElement);

  // Clear floated elements layout
  const clearDiv = document.createElement('div');
  clearDiv.style.clear = 'both';
  messagesContainer.appendChild(clearDiv);

  // Auto-scroll to the bottom of the chat container
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

/**
 * Sends the user message to the FastAPI /chatbot endpoint and updates the UI
 * @param {string} userMessage - Raw text input from user
 */
const sendMessage = async (userMessage) => {
  // 1. Render user message in UI
  addMessage(userMessage, 'user', '/static/images/user.jpeg');

  // 2. Add user input to internal state tracking
  conversationHistory.push({ role: "user", content: userMessage });

  // 3. Render temporary loading indicator
  const loadingElement = document.createElement('div');
  loadingElement.className = 'loading-animation';
  
  const loadingTextElement = document.createElement('p');
  loadingTextElement.className = 'loading-text';
  loadingTextElement.innerText = 'Bot is thinking...';
  
  messagesContainer.appendChild(loadingElement);
  messagesContainer.appendChild(loadingTextElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // 4. Asynchronous HTTP POST request to FastAPI backend
  async function makePostRequest(promptText) {
  const url = '/chatbot';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: promptText })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Server response error:', response.status, errText);
      return { error: `Server returned status ${response.status}: ${errText}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Network/Fetch Error:', error);
    return { error: `Network error: ${error.message}` };
  }
}

  // 5. Execute API call
  const result = await makePostRequest(userMessage);

  // 6. Remove loading indicator
  const loadIndicator = document.querySelector('.loading-animation');
  const loadText = document.querySelector('.loading-text');
  if (loadIndicator) loadIndicator.remove();
  if (loadText) loadText.remove();

  // 7. Render Bot response or Error state
  if (result.error) {
    addMessage(`Error: ${result.error}`, 'error', '/static/images/Error.png');
  } else {
    const botResponse = result.response;
    addMessage(botResponse, 'aibot', '/static/images/Bot_logo.png');

    // Add bot output to state tracking and keep a sliding history window
    conversationHistory.push({ role: "assistant", content: botResponse });
    
    // Retain system prompt (index 0) + last 10 messages (5 turns)
    if (conversationHistory.length > 11) {
      conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-10)];
    }
  }
};

// 8. Event Listener for Form Submission
messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  
  if (text !== '') {
    messageInput.value = ''; // Clear input field
    await sendMessage(text);
  }
});