# AI Scraper Challenge

This project is a simple AI-powered web scraper API built for the AI Scraper Code Challenge. It retrieves and processes content from a given URL, then uses an AI model to summarize or interpret the content.

## Features

- Accepts a URL via GET request
- Scrapes content from the provided webpage
- Uses AI via OpenRouter API (`deepseek-r1` model) to extract structured insights
- Returns structured JSON output
- Built with Node.js and Express.js

---

## Getting Started

Follow the instructions below to run this project locally.

### Prerequisites

- Node.js (version 16 or later)
- npm (Node Package Manager)
- [OpenRouter API key](https://openrouter.ai/)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/salscript/ai-scraper-challenge.git
   cd ai-scraper-challenge

   ```

2. **Instal Depedencies**

   ```
   npm install

   ```

3. **Set up environment variables**
   Create a .env file in the root directory with the following content:

   ```
   DEEPSEEK_API_KEY=your_openrouter_api_key_here
   You can get a free API key by registering at https://openrouter.ai. Make sure to select or enable the deepseek-r1 (a.k.a. deepseek-chat) model

   ```

4. **Run the server**
   ```
   npm start
   ```

## API Documentation

### Endpoint: `/scrape`

**Method:** `GET`  
**Content-Type:** `application/json`  
**URL:** `http://localhost:3000/scrape?keyword=<keyword>&page=<number>`

#### Query Parameters

| Name    | Type   | Required | Description                      |
| ------- | ------ | -------- | -------------------------------- |
| keyword | string | Yes      | The keyword to search and scrape |
| page    | number | No       | Page number for pagination       |

#### Example Request

```http
GET http://localhost:3000/scrape?keyword=nike&page=1

```
