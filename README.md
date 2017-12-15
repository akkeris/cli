
## Installing

Add the following environment variables to your profile:

```bash
npm -g install akkeris
ak
````

## Other env 

These environment variables are only useful if for development.

```
export AKKERIS_API_HOST=apps.yourdomain.io
export AKKERIS_AUTH_HOST=auth.yourdomain.io
export API_AUTH = ".." # used to send "Authorization: ${API_AUTH}"
export API_TOKEN = ".." # used to send "Authorization: Bearer ${API_TOKEN}"
```