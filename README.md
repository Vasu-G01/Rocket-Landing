# AstroLand AI 🚀

### An Intelligent Rocket Landing Simulator

AstroLand AI is a rocket landing simulation project that combines interactive visualization, physics-based simulation and machine learning to explore intelligent rocket landing.

A PPO reinforcement-learning agent is **trained on the exact physics the browser flies**, then lands the rocket by itself: it predicts a best path, draws it on screen and applies the controls one decision at a time.

## Features

- Interactive rocket landing simulation
- Real-time visualization of rocket movement
- Monitoring of fuel and velocity
- Physics-based landing calculations
- **Autopilot (🤖 AI pilot): trained PPO policy lands the rocket on its own**
- **Predicted flight path overlay — watch the plan before it happens**
- **Train / stop / monitor training from the UI**
- Live ML corrections at 10 Hz with a local guidance fallback if the API is down
- Manual keyboard flying stays available (your keys override the AI)
- Simulation history and data storage (SQLite)

## Tech Stack

### Frontend
- React.js
- JavaScript
- HTML Canvas
- CSS

### Backend
- Python
- Flask
- Flask-CORS

### Machine Learning
- Stable-Baselines3 (PPO)
- Gymnasium
- PyTorch (CPU)
- NumPy, Pandas, Scikit-learn

### Database
- SQLite

## Project Structure

```text
AstroLand-AI/
├── frontend/
│   └── src/
│       ├── App.jsx          # canvas simulation + AI pilot integration
│       ├── api.js           # backend client + local guidance fallback
│       └── index.css
├── backend/
│   ├── app.py               # Flask API (predict, plan, train, flights)
│   ├── config.py
│   ├── requirements.txt
│   ├── simulation/
│   │   ├── physics.py       # port of the canvas physics (shared rules)
│   │   └── landing.py       # touchdown evaluation + scoring
│   ├── ml/
│   │   ├── env.py           # Gym environment used for training
│   │   ├── train_model.py   # PPO training + evaluation
│   │   ├── predict.py       # Pilot: policy loading, act(), plan()
│   │   └── models/          # ppo_rocket_land.zip + training status
│   ├── database/
│   │   └── database.py
│   └── tests/
│       ├── test_physics.py        # dynamics + touchdown rules
│       ├── test_prediction.py     # features, guidance, Pilot endpoints
│       ├── test_api_flight.py     # full landing flown over HTTP (API must run)
│       └── status_race_check.py   # manual check: status writes vs concurrent reads
├── .gitignore
└── README.md
```

## Installation

### Backend

Python is managed with [uv](https://docs.astral.sh/uv/) (any Python 3.10+ works):

```powershell
cd backend
uv venv .venv --python 3.12
uv pip install --python .venv\Scripts\python.exe torch --index https://download.pytorch.org/whl/cpu
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
```

Or with plain pip:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Train the model

```powershell
cd backend
.venv\Scripts\python.exe ml\train_model.py --timesteps 500000
```

Useful flags:

| Flag | Meaning |
|---|---|
| `--timesteps 150000` | quicker, less reliable run |
| `--resume` | continue from the saved policy up to the same target |
| `--eval-only` | evaluate the saved policy (no training) |
| `--eval-episodes 50` | number of evaluation landings |

`--resume` adds only the steps still missing to reach `--timesteps`; a run that is
already at the target just evaluates.

Training writes `ml/models/ppo_rocket_land.zip`, `ml/models/training_meta.json` and a
live `ml/models/training_status.json` that the API/UI reads, so you can also press
**🎓 Train model** in the app instead of the CLI. The first ~60k steps spawn close to
the pad, then the spawn distribution widens to the exact randomness of the browser.

## Run

```powershell
# terminal 1 — API on http://127.0.0.1:5000
cd backend
.venv\Scripts\python.exe app.py

# terminal 2 — UI
cd frontend
npm run dev
```

Open http://localhost:5173 and press **🤖 AI pilot: ON**.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | model + training + database overview |
| GET | `/api/model` | loaded policy info (timesteps, eval success rate) |
| POST | `/api/model/reload` | re-read the model file after training |
| POST | `/api/predict` | one control decision for a telemetry state (10 Hz) |
| POST | `/api/plan` | predicted flight path + control sequence |
| POST | `/api/train` | start training in a background process |
| GET | `/api/train/status` | live training progress |
| POST | `/api/train/stop` | graceful stop |
| GET/POST | `/api/flights` | flight history (SQLite) |

## Tests

```powershell
cd backend
.venv\Scripts\python.exe -m unittest discover -s tests
```

`test_api_flight.py` is skipped unless the API is running on :5000 — it flies 20
landings through `/api/predict` exactly like the browser does, and reports the
success rate of the loaded model.

```powershell
# end-to-end flight report without unittest
.venv\Scripts\python.exe tests\test_api_flight.py

# diagnostic: status file written while a concurrent reader hammers it
# (guards against the Windows lock that once killed a training run)
.venv\Scripts\python.exe tests\status_race_check.py
```

## Project Status
🚧 Under Development

## Contributors
This project is being developed collaboratively. Contributions and suggestions are welcome.

## Contributing

Contributions are welcome! Follow these steps to contribute to AstroLand AI.

1. Fork this repository.
2. Clone your fork:

   ```bash
   git clone <your-fork-url>
   ```

3. Navigate to the project directory:

   ```bash
   cd AstroLand-AI
   ```

4. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Make your changes and test them.
6. Commit your changes:

   ```bash
   git add .
   git commit -m "Add: describe your changes"
   ```

7. Push your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

8. Open a Pull Request to the original repository and describe your changes.

### Contribution Guidelines

- Work on your own branch.
- Write clear and meaningful commit messages.
- Do not commit virtual environments, `node_modules`, secrets, or generated files.
- Keep your code clean and well-organized.
- Discuss major changes with the project maintainers before implementing them.
-