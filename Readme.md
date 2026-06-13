
# Install backend dependencies
cd backend
npm install
node src/index.js

# Install frontend dependencies
cd ../frontend
npm install
npm run dev 

.env file madhe ye add kar 
PORT=5000
SESSION_DATA_PATH=./session
CRON_SCHEDULE=0 9,13,18 * * *


qr code will get generated on backedn  just login to start      