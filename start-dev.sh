#!/bin/bash

# Load NVM and use Node 18
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 18

# Kill any process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Start the dev server
npm run dev
