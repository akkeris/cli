# Akkeris Command Line Interface

## Installing

```bash
npm -g install akkeris
ak
```

More information can be found in the [documentation](https://docs.akkeris.io/getting-started/prerequisites-and-installing)

## Environment Variables

```
export AKKERIS_HELP_OLD=true   # Always show the old Akkeris help
```

## Other env

These environment variables are only useful if for development.

```
export AKKERIS_API_HOST=apps.yourdomain.io
export AKKERIS_AUTH_HOST=auth.yourdomain.io
export API_AUTH = ".." # used to send "Authorization: ${API_AUTH}"
export API_TOKEN = ".." # used to send "Authorization: Bearer ${API_TOKEN}"
export AKA_UPDATE_INTERVAL # how often to check for updates (ms, default is 24 hours)
```

Make sure you've added the entries to .netrc as well.

## Documentation

[https://docs.akkeris.io/](https://docs.akkeris.io/)

## Running in Docker

If you don't want to have Node.js installed, or just want to run the Akkeris CLI in a Docker container, you can build a Docker image with:

```bash
docker build -t akkeris-cli .
```

Or use pre-built image from DockerHub: `akkeris/cli`

### Authentication

You can optionally bind your `~/.netrc` and `~/.akkeris/config.json` files to the Docker container so you don't have to go through the profile setup and login process each time you use the container. If you don't have either of those files set up yet, create them.

For example, on MacOS:

```bash
touch ~/.netrc && mkdir -p ~/.akkeris && touch ~/.akkeris/config.json
docker run --rm -it -v ~/.netrc:/root/.netrc -v ~/.akkeris/config.json:/root/.akkeris/config.json akkeris/cli [COMMAND]
```

### Plugins

You can bind a plugins directory to the Docker container if you want to have plugins persist between usages of the Docker container:

```bash
docker run --rm -it -v ~/.akkeris/plugins/:/root/.akkeris/plugins/ akkeris/cli [COMMAND]
```

### Alias

For easier use, you can add an alias to your bash profile:

```bash
alias aka="docker run --rm -it -v ~/.akkeris/plugins/:/root/.akkeris/plugins/ -v ~/.netrc:/root/.netrc -v ~/.akkeris/config.json:/root/.akkeris/config.json akkeris/cli"
```

Then, you can run Akkeris commands inside a Docker container like you had the Akkeris CLI installed locally: `aka version`

## Development

### Getting Started

```bash
# Clone the repo via HTTPS
git clone https://github.com/akkeris/cli.git
# Or via SSH
git clone git@github.com:akkeris/cli.git

# Change directories into the repo
cd cli

# Install dependencies
npm install

# Create a `.env` file from the `.env.example` file
cp -v .env.example .env
# Modify any environment variable values in `.env` as necessary

# Run the local version of the Akkeris CLI by replacing `aka` with `npm run aka`
npm run aka

# Append any `aka` sub-commands onto the end, such as
npm run aka auth:login
npm run aka apps
npm run aka squirrel
# And you're off to the races!
```
