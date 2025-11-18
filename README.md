# n8n-g4f-router

An intelligent, auto-failingover routing proxy to connect **n8n** to **gpt4free (g4f)** providers, ensuring high availability.

This project solves the primary problem with `g4f`: **instability**.

While `g4f` is powerful, its providers (MetaAI, Phind, etc.) go offline constantly. If you connect n8n directly to one provider, your workflow will fail the moment that provider goes down.

`n8n-g4f-router` acts as an intelligent "manager" that sits between n8n and `g4f`.

## 🎯 Core Features

* **Automatic Failover:** If a `g4f` provider fails, the router automatically and instantly retries with the next healthy provider. n8n won't even notice a failure occurred.
* **Active Health Checks:** The router constantly "pings" all `g4f` providers to know, in real-time, which ones are working *before* you even make a request.
* **OpenAI API Compatibility:** Exposes an API 100% compatible with n8n's native "OpenAI" node. No need for complex HTTP request nodes.
* **Secure Authentication:** Protect your proxy endpoint with a simple API Key (Bearer Token).

## ⚙️ How It Works

The architecture is simple but powerful:

`n8n` ➡️ `n8n-g4f-router` ➡️ `g4f (Service)`
(OpenAI Node) (This Project) (gpt4free Service)

1.  **n8n** makes a call to the `n8n-g4f-router` (thinking it's the official OpenAI API).
2.  The **Router** checks its internal list of *healthy* providers.
3.  It forwards the request to the first healthy provider (e.g., `Phind`).
4.  If `Phind` fails, the Router catches the error, marks `Phind` as "offline," and automatically retries with the next provider in the list (e.g., `MetaAI`).
5.  A successful response is streamed back to n8n.

## 🚀 Getting Started

### Prerequisites

* [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

### Installation

1.  Clone this repository:
    ```bash
    git clone [https://github.com/dsc2q/n8n-g4f-router.git](https://github.com/dsc2q/n8n-g4f-router.git)
    cd n8n-g4f-router
    ```

2.  Create your environment file from the example:
    ```bash
    cp .env.example .env
    ```

3.  Edit your new `.env` file and set a secure `ROUTER_API_KEY`:
    ```ini
    ROUTER_API_KEY=my_super_secure_key_123
    ```

4.  Start the services using Docker Compose:
    ```bash
    docker-compose up -d --build
    ```

Your router is now running at `http://localhost:3000`.

## 🤖 Configuring in n8n

This is the best part: you get to use the native OpenAI node!

1.  In n8n, go to **Credentials** and add a new **OpenAI API** credential.
2.  Fill out the fields as follows:
    * **Name:** `g4f Router` (or your preferred name)
    * **API Key:** The `ROUTER_API_KEY` you set in your `.env` file (e.g., `my_super_secure_key_123`).
    * **Host (in "Advanced"):** `http://localhost:3000`

3.  Save the credential.
4.  Now, in any workflow, add the **OpenAI (Chat Model)** node, select your new `g4f Router` credential, and use it as you normally would!

## 🔧 Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ROUTER_PORT` | The port the router will listen on. | `3000` |
| `G4F_UPSTREAM_URL` | The internal URL of the `g4f` service. | `http://g4f:8080` |
| `ROUTER_API_KEY` | The Bearer Token to protect your router. | `(Required)` |
| `HEALTH_CHECK_INTERVAL_MS` | How often (in ms) the router tests providers. | `300000` (5 min) |