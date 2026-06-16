const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// फायरबेस बेस युआरएल
const FIREBASE_BASE_URL = "https://cash-jitau-default-rtdb.firebaseio.com";

app.get('/', (req, res) => {
    res.send("<h1>REST API Postback Server is Live!</h1>");
});

app.get('/postback', async (req, res) => {
    const { user_id, reward, transaction_id } = req.query;

    if (!user_id || !reward || !transaction_id) {
        return res.status(400).send("Missing parameters");
    }

    try {
        const rewardAmount = Math.trunc(Number(reward));
        
        // फायरबेसबाट सिधै युजरको हालको ब्यालेन्स तान्ने (GET Request)
        const userUrl = `${FIREBASE_BASE_URL}/users/${user_id}/balance.json`;
        const response = await axios.get(userUrl);
        
        const currentBalance = response.data !== null ? response.data : 0;
        const newBalance = currentBalance + rewardAmount;

        // फायरबेसमा नयाँ ब्यालेन्स सिधै सेभ गर्ने (PUT Request)
        await axios.put(userUrl, newBalance);

        console.log(`✅ SUCCESS: Added ${rewardAmount} to User: ${user_id}. New: ${newBalance}`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("❌ Network/Firebase Error:", error.message);
        // यदि कुनै नेटवर्क इस्यु आयो भने पनि GrowDeck लाई झुलाएर नराख्ने, सिधै OK दिने
        return res.status(200).send("OK");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
