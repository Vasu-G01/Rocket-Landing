# AstroLand AI — System Architecture

## 1. Overview

AstroLand AI is an intelligent rocket landing simulator designed to combine interactive visualization, physics-based simulation, and machine learning.

The project follows a frontend-backend architecture. The frontend handles the user interface and rocket visualization, while the Python backend manages simulation logic, ML predictions, and data storage.

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, JavaScript |
| Graphics | HTML Canvas |
| Styling | CSS |
| Backend | Python, Flask |
| API Communication | Flask-CORS |
| Machine Learning | Scikit-learn, NumPy, Pandas |
| Database | SQLite |

## 3. Project Structure

```text
AstroLand-AI/
├── frontend/
│   ├── public/
│   │   └── assets/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RocketCanvas.jsx
│   │   │   ├── GameDashboard.jsx
│   │   │   ├── FuelMeter.jsx
│   │   │   └── VelocityMeter.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Simulation.jsx
│   │   │   └── History.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── package.json
│
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── simulation/
│   │   ├── physics.py
│   │   └── landing.py
│   ├── ml/
│   │   ├── train_model.py
│   │   └── predict.py
│   └── database/
│       └── database.py
│
├── tests/
│   ├── test_physics.py
│   └── test_prediction.py
│
├── .gitignore
├── README.md
└── ARCHITECTURE.md
```

## 4. Component Responsibilities

### Frontend
- **Home.jsx:** Project landing page.
- **Simulation.jsx:** Rocket simulation screen.
- **RocketCanvas.jsx:** Rocket movement and visual animation.
- **GameDashboard.jsx:** Displays simulation information.
- **FuelMeter.jsx:** Shows remaining fuel.
- **VelocityMeter.jsx:** Shows rocket velocity.
- **History.jsx:** Displays saved simulation history.

### Backend
- **app.py:** Flask application and API endpoints.
- **config.py:** Application configuration.
- **physics.py:** Rocket physics calculations.
- **landing.py:** Landing simulation logic.
- **train_model.py:** Trains the machine learning model.
- **predict.py:** Generates ML predictions.
- **database.py:** Handles SQLite database operations.

### Tests
- **test_physics.py:** Tests physics calculations.
- **test_prediction.py:** Tests ML prediction functionality.

## 5. System Workflow

1. The user interacts with the React frontend.
2. The frontend renders the rocket simulation using HTML Canvas.
3. The frontend communicates with the Flask backend through API requests.
4. The backend performs simulation calculations and requests ML predictions when needed.
5. The database stores relevant simulation results.
6. The frontend displays the updated simulation state to the user.

## 6. Team Development Guidelines

- Keep frontend and backend code in their respective folders.
- Create a separate feature branch for each task.
- Test changes before opening a Pull Request.
- Keep dependencies documented in `package.json` and `requirements.txt`.
- Never commit secrets or virtual environment folders.
- Update this document when the architecture changes.

## 7. Project Status

Under Development. The structure describes the planned architecture; individual components may not be implemented yet.