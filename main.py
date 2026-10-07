```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import pandas as pd
import joblib
import os


# --------------------------------------------------
# FastAPI
# --------------------------------------------------

app = FastAPI(
    title="NYC Airbnb Room Type Predictor",
    description="Predict Airbnb room type using a machine learning model.",
    version="1.0.0"
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Model
# --------------------------------------------------

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "Model_Pipeline.pkl"
)

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# Model columns
# --------------------------------------------------

COLUMNS = [
    "latitude",
    "longitude",
    "price",
    "minimum_nights",
    "number_of_reviews",
    "reviews_per_month",
    "calculated_host_listings_count",
    "availability_365",
    "neighbourhood_group",
    "neighbourhood",
]


# --------------------------------------------------
# Input validation
# --------------------------------------------------

class Features(BaseModel):

    latitude: float = Field(..., ge=-90, le=90)

    longitude: float = Field(..., ge=-180, le=180)

    price: float = Field(..., gt=0)

    minimum_nights: int = Field(
        ...,
        ge=1,
        le=365
    )

    number_of_reviews: int = Field(
        ...,
        ge=0
    )

    reviews_per_month: float = Field(
        ...,
        ge=0
    )

    calculated_host_listings_count: int = Field(
        ...,
        ge=0
    )

    availability_365: int = Field(
        ...,
        ge=0,
        le=365
    )

    neighbourhood_group: str = Field(
        ...,
        min_length=1
    )

    neighbourhood: str = Field(
        ...,
        min_length=1
    )


# --------------------------------------------------
# API health check
# --------------------------------------------------

@app.get("/api")
def api_home():

    return {
        "message": "NYC Airbnb Room Type Predictor API is running"
    }


# --------------------------------------------------
# Prediction
# --------------------------------------------------

@app.post("/predict")
def predict(features: Features):

    data = features.model_dump()

    row = pd.DataFrame(
        [data],
        columns=COLUMNS
    )

    prediction = model.predict(row)

    probability = model.predict_proba(row)

    return {
        "Predicted_room_type": prediction.tolist(),
        "Probability": probability.tolist()
    }


# --------------------------------------------------
# Serve frontend
# --------------------------------------------------

frontend_path = os.path.join(
    os.path.dirname(__file__),
    "frontend"
)

app.mount(
    "/static",
    StaticFiles(directory=frontend_path),
    name="static"
)


@app.get("/")
def dashboard():

    return FileResponse(
        os.path.join(
            frontend_path,
            "index.html"
        )
    )
```
