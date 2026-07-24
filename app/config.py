from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    deepline_cli_path: str = "deepline"

    class Config:
        env_file = ".env"


settings = Settings()
