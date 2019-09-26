## Installing

```bash
npm -g install akkeris
ak
```

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