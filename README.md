# שולחן צ'יפים

הקלפים אמיתיים, הצ'יפים בטלפון. כל שחקן משחק מהטלפון שלו, והדילר מנהל את השולחן. יש טקסס הולדם ובלאק ג'ק.

האפליקציה היא קבצים סטטיים, שנבנים עם Vite מהתיקייה `src`. Firebase מסנכרן את השולחן בין הטלפונים בזמן אמת, בחינם (תוכנית Spark).
מפתחים? ראו `CLAUDE.md`, `docs/ARCHITECTURE.md` ו־`docs/TESTING.md`. מה השתנה: `CHANGELOG.md`.

## 1. פרויקט Firebase (בערך 5 דקות)
1. נכנסים ל־https://console.firebase.google.com ← **Add project** ← שם כלשהו (למשל `chips-table`). אפשר לכבות את Google Analytics.
2. בתפריט הצד: **Build ← Firestore Database ← Create database**. בוחרים מיקום (למשל `eur3`) ו־**production mode**.
3. בלשונית **Rules** של Firestore: מוחקים את מה שיש, מדביקים את התוכן של `firestore.rules` ולוחצים **Publish**.
4. בגלגל השיניים ← **Project settings ← Your apps** ← אייקון `</>` (Web). נותנים שם ולוחצים Register.
5. מעתיקים את הערכים מ־`firebaseConfig` למשתני סביבה ב־Netlify (Project configuration ← Environment variables):
   `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`.
   בזמן ה־deploy הסקריפט `scripts/build-config.js` יוצר מהם את `config.js` (כולל מספר הגרסה שמשמש לעדכון אוטומטי). הקובץ לא נשמר בריפו.
   לבדיקה מקומית: `npm install` ואז `npm run dev`. בלי `config.js` האפליקציה עובדת במצב מכשיר אחד; עם Firebase מעתיקים את `config.example.js` ל־`config.js` וממלאים.

## 2. העלאה לאוויר
- **Netlify מחובר לריפו (מה שמשמש עכשיו):** כל push ל־`main` עולה לאוויר תוך דקה־שתיים. Netlify בונה את האתר (`npm run build`), כותב את `config.js` ומעלה את התיקייה `dist`. הכל כתוב ב־`netlify.toml`, אז אין מה לשנות בהגדרות של Netlify. הפיתוח נעשה בענף צדדי, ול־`main` דוחפים רק כשמוכנים, כדי שאפשר יהיה להמשיך לשחק בגרסה היציבה. בכל push רצות כל הבדיקות ב־GitHub (לשונית Actions), כך שרואים שהכל ירוק לפני שמעלים ל־`main`.
- **אחרות (Netlify Drop, Firebase Hosting, GitHub Pages):** עובדות, אבל לא בונות את האתר. בונים במחשב (`npm install` ואז `npm run build`), יוצרים את `config.js` בתוך `dist` (`node scripts/build-config.js dist` עם משתני הסביבה, או ידנית), ומעלים את התיקייה `dist`. בלי `config.js` אין סנכרון בין טלפונים ואין עדכון אוטומטי.

האתר חייב לרוץ על https כדי שההתקנה כאפליקציה, המצלמה והצלילים יעבדו. כל האפשרויות למעלה נותנות https.

## 3. התקנה בטלפון
- **אנדרואיד (Chrome):** כפתור "התקנת האפליקציה" במסך הראשי, או תפריט ← "התקנת אפליקציה".
- **אייפון (Safari):** שיתוף ← "הוספה למסך הבית".

**עדכונים:** האפליקציה בודקת לבד אם יש גרסה חדשה ומתעדכנת כשלא באמצע פעולה (אחרת מופיע כפתור "יש גרסה חדשה"). מספר הגרסה מופיע בתחתית "הגדרות", כך שאפשר להשוות בין טלפונים. טלפון שעוד לא קיבל את מנגנון העדכון צריך פעם אחת לסגור את האפליקציה לגמרי ולפתוח מחדש.

## 4. משחק
- **שם ותמונה:** במסך הראשי כותבים שם ולוחצים על העיגול כדי לצלם תמונה, לבחור מהגלריה או לבחור דמות. אפשר להחליף גם בלחיצה על המושב שלכם בשולחן או ממסך "שחקנים".
- **פתיחת שולחן:** מי שפותח שולחן הוא הדילר: מתחיל ידיים, מקדם רחובות, מסמן זוכים ומשלם.
- **הזמנה:** "שיתוף הזמנה" שולח קישור שפותח ישר את השולחן. אפשר גם להקליד את הקוד בן 4 האותיות.
- **שחקן בלי טלפון:** הדילר מוסיף אותו ממסך "שחקנים" ומנהל לו את הצ'יפים.
- **לרוחב:** משחקים עם הטלפון לרוחב. השולחן ממלא את המסך והכפתורים בצד. כשמחזיקים לאורך בתוך שולחן, מופיעה בקשה לסובב.
- **הימור:** לוחצים על צ'יפים במגש והם עפים למעגל ההימור שלכם. כולם רואים בדיוק את הצ'יפים ששמתם.
- **בלאק ג'ק באמצע סיבוב:** אחרי החלוקה, לדילר יש "בלאק ג'ק לשחקן". השחקן מקבל מיד 3:2, והיד לא משולמת שוב בסוף הסיבוב.
- **סוף המשחק:** "סיום המשחק" אצל הדילר מראה את הדירוג ומכריז על המנצח. בכל הטלפונים יש טקס, ואז השולחן נסגר. אפשר לצפות בטקס שוב, והדילר יכול לפתוח את השולחן מחדש.
- **שפה:** עברית או אנגלית, לכל טלפון בנפרד: "EN / עב" בפינה של המסך הראשי, או "שפה" ב"הגדרות". אפשר לשחק יחד בשולחן גם כשכל אחד בשפה אחרת. הקריינות של הדילרית בשפה של הטלפון.
- **צלילים:** כפתור הרמקול בראש המסך משתיק הכל. ברקע נשמעים מדי פעם מכונות מזל ואנשים מדברים בשקט (ראו `sounds/CREDITS.md`), והדילרית מקריינת בקול מה קורה ("ההימורים ננעלו", "פלופ", "המנצח"). אפשר לכבות כל אחד בנפרד ב"הגדרות" ← "אווירת קזינו ברקע" ו"קריינות הדילרית". באייפון אין צלילים כשמתג ההשתקה בצד דלוק.

## הערה על אבטחה ופרטיות
החוקים מאפשרים לכל מי שיש לו את הקישור לקרוא ולכתוב רק לאוסף `rooms`, וזה מספיק למשחק בין חברים.
שמות, צ'יפים ותמונות הפרופיל נשמרים בשולחן, וכל מי שיש לו את הקוד יכול לראות אותם. התמונה מוקטנת בטלפון לפני שהיא נשלחת. אל תשתמשו בתמונה שלא הייתם רוצים שהחברים בשולחן יראו.

---

# Chips (English)

Real cards on the table, the chips on your phone. Every player plays from their own phone and the dealer runs the
table. Texas Hold'em and Blackjack. The app is in English and Hebrew: each phone chooses its own ("EN / עב" in the
home screen's top corner, or Language in Settings), and players with different languages share a table.

It is a static web app built with Vite from `src/`. Firebase syncs the table between phones in real time, for free
(the Spark plan). Developers: see `CLAUDE.md`, `docs/ARCHITECTURE.md` and `docs/TESTING.md`; what changed is in
`CHANGELOG.md`.

## 1. A Firebase project (about 5 minutes)
1. Go to https://console.firebase.google.com → **Add project** → any name (e.g. `chips-table`). Google Analytics can be
   turned off.
2. In the side menu: **Build → Firestore Database → Create database**. Pick a location (e.g. `eur3`) and
   **production mode**.
3. On Firestore's **Rules** tab: delete what is there, paste the contents of `firestore.rules` and click **Publish**.
4. Gear icon → **Project settings → Your apps** → the `</>` (Web) icon. Give it a name and click Register.
5. Copy the values from `firebaseConfig` into environment variables on Netlify (Project configuration → Environment
   variables): `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. At deploy
   time `scripts/build-config.js` writes `config.js` from them (with the build number the self-update uses). The file is
   not in the repository. To try it locally: `npm install`, then `npm run dev`. Without `config.js` the app runs in
   single-device mode; for Firebase, copy `config.example.js` to `config.js` and fill it in.

## 2. Putting it online
- **Netlify linked to the repository (what is used now):** every push to `main` is live within a minute or two.
  Netlify builds the site (`npm run build`), writes `config.js` and publishes `dist`; it is all in `netlify.toml`.
  Work happens on a side branch and goes to `main` only when it is ready, so the stable version stays playable. Every
  push runs all the checks on GitHub (the Actions tab).
- **Others (Netlify Drop, Firebase Hosting, GitHub Pages):** work, but don't build the site. Build on a computer
  (`npm install`, then `npm run build`), write `config.js` into `dist` (`node scripts/build-config.js dist` with the
  environment variables, or by hand) and upload `dist`. Without `config.js` there is no sync and no self-update.

The site must be served over https for installing, the camera and sound to work; all the options above are.

## 3. Installing on a phone
- **Android (Chrome):** the "Install the app on this phone" button on the home screen, or menu → "Install app".
- **iPhone (Safari):** Share → "Add to Home Screen". The app installs as "Chips" in English and "צ'יפים" in Hebrew
  (the language the phone is in when it is installed; an installed app keeps its name).

**Updates:** the app checks for a new version itself and updates when you are not in the middle of something
(otherwise a "New version" button shows). The version is at the bottom of Settings, to compare phones.

## 4. Playing
- **Name and picture:** type a name on the home screen and tap the circle to take a photo, pick one from the gallery or
  pick a character. You can change it by tapping your seat or from Players.
- **Opening a table:** whoever opens it is the dealer: starts hands, deals the streets, marks winners and pays.
- **Inviting:** "Share invite" sends a link that opens the table. The 4-letter code works too.
- **A player without a phone:** the dealer adds them in Players and handles their chips.
- **Sideways:** the table fills a phone held sideways, with the buttons at the side; held upright inside a table, the
  app asks you to turn it.
- **Betting:** tap chips in the tray and they fly to your betting circle. Everyone sees exactly the chips you put down.
- **Blackjack mid-round:** after the deal the dealer has "Pay a blackjack": the player gets 3:2 at once, and the hand
  isn't paid again at the end of the round.
- **End of the game:** "End the game" shows the standings and announces the winner, with a ceremony on every phone;
  then the table closes. The ceremony can be watched again, and the dealer can reopen the table.
- **Language:** each phone in English or Hebrew; the table's event line, toasts and the dealer's voice follow it.
- **Sound:** the speaker button mutes everything. In the background there are slot machines and quiet talk now and then,
  and the dealer says what happens ("No more bets", "The flop", "We have a winner!"). Each can be turned off in
  Settings ("Casino background", "Dealer's voice"). iPhones are silent with the mute switch on.

## Security and privacy
The rules let anyone with the link read and write only the `rooms` collection, which is enough for a game among
friends. Names, chips and profile pictures are stored in the table, and anyone with the code can see them. The picture
is shrunk on the phone before it is sent. Don't use a picture you wouldn't want the people at the table to see.
