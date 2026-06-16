const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// हजुरको नयाँ विवरणहरू
const GROWDECK_SECRET_KEY = "3c3d05d36dfdfd6539fb"; 
const FIREBASE_DB_URL = "https://cash-jitau-default-rtdb.firebaseio.com/users";

app.get('/postback', async (req, res) => {
    try {
        // GrowDeck ले पठाउने सबै आवश्यक विवरणहरू लिने
        const { user_id, reward, transaction_id, signature } = req.query;

        // १. विवरण अपूर्ण भएमा रोक्ने
        if (!user_id || !reward || !transaction_id || !signature) {
            return res.status(400).send("विवरण अपूर्ण छ");
        }

        // २. सुरक्षा जाँच (Signature Verification) - यसले ह्याकरहरूबाट बचाउँछ
        const rewardTruncated = Math.trunc(Number(reward));
        const template = `${GROWDECK_SECRET_KEY}.${user_id}.${rewardTruncated}.${transaction_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', GROWDECK_SECRET_KEY)
            .update(template)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.log("चेतावनी: गलत सिग्नेचर! अवैध रिक्वेस्ट।");
            return res.status(403).send("अवैध रिक्वेस्ट।");
        }

        // ३. Firebase बाट यो युजरको हालको डाटा तान्ने
        const getUserResponse = await fetch(`${FIREBASE_DB_URL}/${user_id}.json`);
        const userData = await getUserResponse.json();
        
        let currentCoins = 0;
        if (userData) {
            currentCoins = Number(userData.coins || userData.balance || 0);
        }

        // ४. पुरानो कोइनमा नयाँ रिवार्ड थप्ने
        const newCoins = currentCoins + Number(reward);

        // ५. Firebase मा डाटा सुरक्षित रूपमा अपडेट गर्ने
        await fetch(`${FIREBASE_DB_URL}/${user_id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                coins: newCoins,
                balance: newCoins
            })
        });

        console.log(`सफलतापूर्वक युजर ${user_id} को नयाँ ब्यालेन्स ${newCoins} भयो।`);
        return res.status(200).send("OK");

    } catch (error) {
        console.error("सर्भरमा समस्या आयो:", error);
        return res.status(500).send("Database Error");
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
