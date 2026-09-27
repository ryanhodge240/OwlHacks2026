Command to change lights:

```sh
curl -i \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI1OTM3MWFmMzU1MjA0MDI2YThjMWUyNDhhZjgyMjlkMCIsImlhdCI6MTc5MDQ1NTI4NiwiZXhwIjoyMTA1ODE1Mjg2fQ.mgkGcLFKbNk9AQwCReZkiKQRm6l6nDD2AfTKMC9Vzcs" \
  -H "Content-Type: application/json" \
  -d "{\"entity_id\":\"light.bedroom_lifx_color\",\"rgb_color\":[0,0,255],\"brightness\":100}" \
  "http://100.84.110.82/api/services/light/turn_on"
```