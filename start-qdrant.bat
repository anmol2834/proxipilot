@echo off
echo Starting Qdrant vector database...
docker start qdrant
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Qdrant is running!
    echo   Dashboard : http://localhost:6333/dashboard
    echo   REST API  : http://localhost:6333
    echo   gRPC      : http://localhost:6334
    echo.
) else (
    echo.
    echo Qdrant container not found. Starting fresh...
    docker run -d --name qdrant --restart unless-stopped -p 6333:6333 -p 6334:6334 -v qdrant_data:/qdrant/storage qdrant/qdrant:v1.7.4
    echo.
    echo Qdrant started fresh!
    echo   Dashboard : http://localhost:6333/dashboard
    echo   REST API  : http://localhost:6333
    echo.
)
