CREATE TABLE game_accounts (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(100) UNIQUE NOT NULL,
    level VARCHAR(50)
);
