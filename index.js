const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// विवरणहरू (तपाईंको डेटाबेस संरचना अनुसार)
const GROWDECK_SECRET_KEY = "3c3d05d36dfdfd6539fb"; 
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com/users";

app.get('/postback', async (req, res) => {
    try {
        const { user_id, reward, transaction_id, signature } = req.query;

        // १. विवरण जाँच
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("विवरण अपूर्ण छ");
        }

        // २. सिग्नेचर प्रमाणीकरण (तपाईंको स्ट्रिङ फर्म्याट सिधै मिलाइएको)
        const template = `${GROWDECK_SECRET_KEY}.${user_id}.${reward}.${transaction_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', GROWDECK_SECRET_KEY)
            .update(template)
            .digest('hex');

        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            console.log("चेतावनी: गलत सिग्नेचर! अवैध रिक्वेस्ट।");
            return res.status(403).send("अवैध रिक्वेस्ट।");
        }

        // ३. Firebase बाट युजरको डाटा तान्ने
        const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
        const userData = await getUserResponse.json();
        
        if (!userData) {
            console.log(`युजर ${user_id} डाटाबेसमा फेला परेन।`);
            return res.status(404).send("User not found");
        }

        // ४. इमेजमा देखिए अनुसार युजरको मात्र 'balance' अपडेट गर्ने
        const currentBalance = Number(userData.balance || 0);
        const newBalance = currentBalance + Number(reward);

        // ५. Firebase मा डाटा सुरक्षित रूपमा PATCH गर्ने (केबल balance मात्र)
        await fetch(`${FIREBASE_DB_URL}/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                balance: newBalance
            })
        });

        console.log(`सफलतापूर्वक युजर ${user_id} को नयाँ ब्यालेन्स ${newBalance} भयो।`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("सर्भरमा समस्या आयो:", error);
        return res.status(500).send("Database Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
