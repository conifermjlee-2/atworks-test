$promptFile = 'prompt.txt'
"hello" | Out-File $promptFile -Encoding utf8
$schemaFile = 'schema.json'
'{ "type": "object", "properties": { "scenarios": { "type": "array" } } }' | Out-File $schemaFile -Encoding utf8
Get-Content -Raw -Path $promptFile | agy --output-format json --json-schema $schemaFile --print - *>&1
