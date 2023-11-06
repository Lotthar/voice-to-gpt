# Use the official Node.js image as a base
FROM node:21-bullseye
# Set the working directory in the container
WORKDIR /usr/src/app
# Copy package.json and package-lock.json into the container
COPY package*.json ./
# Install application dependencies
RUN npm install
# Copy the application code into the container
COPY . .
# Compile ts files to plain js dist
RUN npm run build

# Start the application
CMD [ "npm", "start" ]