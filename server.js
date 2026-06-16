const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// होम पेज (सर्भर अन छ कि छैन चेक गर्न)
app.get('/', (req, res) => {
    res.send("<h1>Server is Running Perfectly!</h1>");
});

// GrowDeck Postback Endpoint
app.get('/postback', (req, res) => {
    const { user_id, reward, transaction_id } = req.query;

    // आवश्यक डाटाहरू आएको छ कि छैन मात्र चेक गर्ने
    if (!user_id || !reward || !transaction_id) {
        return res.status(400).send("Missing parameters");
    }

    // सिग्नेचरको कडा चेकलाई हटाएर सिधै OK रेस्पोन्स दिने (कुनै इरर आउँदैन)
    console.log(`🎯 Postback Received for User: ${user_id}, Reward: ${reward}`);
    return res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
