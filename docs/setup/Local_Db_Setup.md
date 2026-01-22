# Local database setup (SQL Server via Docker)

LocalDB is not available on macOS. Use a local SQL Server container instead.

## Start SQL Server
```bash
docker run -e 'ACCEPT_EULA=Y' -e 'MSSQL_SA_PASSWORD=YourStrong!Passw0rd' \
  -p 1433:1433 --name dogtrials-sql \
  --health-cmd '/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "YourStrong!Passw0rd" -Q "SELECT 1"' \
  --health-interval 10s --health-timeout 5s --health-retries 10 \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

## Connection string
Use for tests and local dev:
```
Server=localhost,1433;Database=DogTrialsTests;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;
```

## Run tests with SQL
```bash
DOGTRIALS_TEST_SQL='Server=localhost,1433;Database=DogTrialsTests;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;' \
  dotnet test DogTrials.sln -v minimal
```

## Stop and remove
```bash
docker stop dogtrials-sql
docker rm dogtrials-sql
```
