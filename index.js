const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// तपाईंको सही विवरणहरू
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com/users";
const POSTBACK_SECRET_KEY = "e4574240c62e6c2db436ca744c949e"; // तपाईंले दिनुभएको नयाँ Key

app.get('/postback', async (req, res) => {
    try {
        const { user_id, reward, transaction_id, signature } = req.query;

        // १. पारामिटरहरू चेक गर्ने
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("विवरण अपूर्ण छ");
        }

        // २. आधिकारिक डकुमेन्ट अनुसार Signature तयार पार्ने
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${POSTBACK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', POSTBACK_SECRET_KEY)
            .update(template)
            .digest('hex');

        // ३. सुरक्षा जाँच (Signature Verification)
        if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
            console.log("चेतावनी: गलत सिग्नेचर! अवैध रिक्वेस्ट।");
            return res.status(403).send("अवैध रिक्वेस्ट।");
        }

        // ४. Firebase बाट युजरको डाटा तान्ने
        const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
        const userData = await getUserResponse.json();
        
        if (!userData) {
            console.log(`युजर ${user_id} डाटाबेसमा फेला परेन।`);
            return res.status(404).send("User not found");
        }

        // ५. डाटाबेसको 'balance' मा रिवार्ड थप्ने
        const currentBalance = Number(userData.balance || 0);
        const newBalance = currentBalance + Number(reward);

        // ६. Firebase मा नयाँ ब्यालेन्स अपडेट गर्ने
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
