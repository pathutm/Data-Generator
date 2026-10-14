import json

WORKFLOW_PATH = "scratch/workflow-1791618859351.json"

with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

nodes = wf.get("nodes", [])

for node in nodes:
    nid = node.get("id")

    # 1. groq-1791354884270004
    if nid == "groq-1791354884270004":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        prompt_text = (
            "You are a **Universal Dataset Collection & Discovery Agent**. Your task is to analyze the user's request "
            "and identify suitable, publicly accessible datasets across any domain (such as Insurance, Healthcare, Procurement, "
            "Finance, E-Commerce, Supply Chain, etc.) for a conversational analytics system.\\n\\n"
            "## Responsibilities\\n\\n"
            "1. Understand the user's dataset requirements precisely.\\n"
            "2. Identify suitable free datasets from reliable public sources such as GitHub, Hugging Face, Kaggle, and other open-data repositories.\\n"
            "3. Prioritize datasets containing multiple related CSV tables matching the user's topic.\\n"
            "4. Derive the exact request topic dynamically based on the user's actual prompt.\\n"
            "5. Require direct downloadable URLs or archives containing the relevant files.\\n"
            "6. Never invent datasets, download URLs, table names, or verification results.\\n\\n"
            "## Output Requirements\\n\\n"
            "Return **only one valid JSON object**. Do not include Markdown, code fences, explanations, or text outside the JSON.\\n\\n"
            "Use exactly this structure:\\n\\n"
            "{\\n"
            '\\"request_topic\\": \\"\\",\\n'
            '\\"requirement_summary\\\": \\"\\",\\n'
            '\\"domain\\\": \\"\\",\\n'
            '\\"industry\\\": \\"\\",\\n'
            '\\"entities\\\": [],\\n'
            '\\"required_fields\\\": [],\\n'
            '\\"relationships\\\": [],\\n'
            '\\"time_period\\\": \\"\\",\\n'
            '\\"data_volume\\\": \\"\\",\\n'
            '\\"business_rules\\\": [],\\n'
            '\\"required_datasets\\\": [],\\n'
            '\\"csv_requirements\\\": \\"\\"\\n'
            "}\\n\\n"
            "## Field Rules\\n\\n"
            "* `request_topic`: Dynamically derived domain or topic name matching the user's actual request (for example: 'Insurance' if the user asks for insurance/policies/claims, 'Procurement' if the user asks for suppliers/purchase orders, 'Healthcare' if health-related, etc.). NEVER default to 'Procurement' unless the user's request explicitly asks for procurement.\\n"
            "* `requirement_summary`: Concise summary of the user's actual dataset requirements.\\n"
            "* `domain`: Business domain directly relevant to the user's request (e.g. Insurance, Procurement, Healthcare, Finance).\\n"
            "* `industry`: Industry if specified; otherwise use an empty string.\\n"
            "* `entities`: List the relevant entities matching the user's request.\\n"
            "* `required_fields`: List the important fields and identifiers needed.\\n"
            "* `relationships`: Describe the required relationships between entities.\\n"
            "* `time_period`: Requested period, or an empty string if unspecified.\\n"
            "* `data_volume`: Requested data volume, or an empty string if unspecified.\\n"
            "* `business_rules`: List constraints and validation criteria.\\n"
            "* `required_datasets`: List dataset candidates if known; otherwise empty array.\\n"
            "* `csv_requirements`: State CSV format and download requirements.\\n\\n"
            "## User Request:\\n"
            '{{$node["webhook-1791618803607002"].json.body?.message || $node["webhook-1791618803607002"].json.body?.query || $node["webhook-1791618803607002"].json.body?.topic || $json.body?.message || $json.message || ""}}\\n'
        )
        inputs["prompt"] = prompt_text

    # 2. code.execute-1791438368178001 ("Add Request Topic")
    elif nid == "code.execute-1791438368178001":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        inputs["code"] = (
            "const items = $input.all();\n\n"
            "// Retrieve dynamically derived topic from upstream Groq or Webhook\n"
            "let upstreamTopic = '';\n"
            "try {\n"
            "  upstreamTopic = String(\n"
            '    $node["code.execute-1791355811168006"]?.json?.request_topic ||\n'
            '    $node["webhook-1791618803607002"]?.json?.body?.topic ||\n'
            '    $node["webhook-1791618803607002"]?.json?.body?.request_topic ||\n'
            "    ''\n"
            "  ).trim();\n"
            "} catch (e) {}\n\n"
            "return items.map(item => {\n"
            "  const data = item.json || {};\n"
            "  let requestTopic = upstreamTopic;\n\n"
            "  if (!requestTopic) {\n"
            "    const rawMsg = String(\n"
            "      data.query || data.message || ''\n"
            "    ).trim();\n"
            "    const lowerMsg = rawMsg.toLowerCase();\n\n"
            "    if (\n"
            "      lowerMsg.includes('insurance') ||\n"
            "      lowerMsg.includes('claim') ||\n"
            "      lowerMsg.includes('premium') ||\n"
            "      lowerMsg.includes('policy')\n"
            "    ) {\n"
            "      requestTopic = 'Insurance';\n"
            "    } else if (\n"
            "      lowerMsg.includes('procurement') ||\n"
            "      lowerMsg.includes('purchase order') ||\n"
            "      lowerMsg.includes('supplier') ||\n"
            "      lowerMsg.includes('vendor')\n"
            "    ) {\n"
            "      requestTopic = 'Procurement';\n"
            "    } else if (\n"
            "      lowerMsg.includes('supply chain') ||\n"
            "      lowerMsg.includes('logistics') ||\n"
            "      lowerMsg.includes('shipment') ||\n"
            "      lowerMsg.includes('warehouse')\n"
            "    ) {\n"
            "      requestTopic = 'Supply Chain';\n"
            "    } else if (\n"
            "      lowerMsg.includes('health') ||\n"
            "      lowerMsg.includes('hospital') ||\n"
            "      lowerMsg.includes('patient')\n"
            "    ) {\n"
            "      requestTopic = 'Healthcare';\n"
            "    } else if (\n"
            "      lowerMsg.includes('finance') ||\n"
            "      lowerMsg.includes('financial') ||\n"
            "      lowerMsg.includes('revenue') ||\n"
            "      lowerMsg.includes('banking')\n"
            "    ) {\n"
            "      requestTopic = 'Finance';\n"
            "    } else if (\n"
            "      lowerMsg.includes('e-commerce') ||\n"
            "      lowerMsg.includes('ecommerce') ||\n"
            "      lowerMsg.includes('retail')\n"
            "    ) {\n"
            "      requestTopic = 'E-Commerce';\n"
            "    } else if (rawMsg) {\n"
            "      const words = rawMsg.replace(/^(find|datasets?|for|about|containing)\\\\s+/i, '').split(/\\\\s+/).slice(0, 3).join(' ');\n"
            "      requestTopic = words ? words.charAt(0).toUpperCase() + words.slice(1) : '';\n"
            "    }\n"
            "  }\n\n"
            "  return {\n"
            "    json: {\n"
            "      ...data,\n"
            "      request_topic: requestTopic\n"
            "    }\n"
            "  };\n"
            "});"
        )

    # 3. code.execute-1791370818030034 ("Kaggle code")
    elif nid == "code.execute-1791370818030034":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        inputs["code"] = (
            "const urls = ($json.kaggle_api_urls || '')\n"
            "  .split(',')\n"
            "  .map(url => url.trim())\n"
            "  .filter(Boolean);\n\n"
            "let requestTopic = String($json.request_topic || '').trim();\n"
            "if (!requestTopic) {\n"
            "  try {\n"
            "    requestTopic = String(\n"
            '      $node["code.execute-1791438368178001"]?.json?.request_topic ||\n'
            '      $node["code.execute-1791355811168006"]?.json?.request_topic ||\n'
            '      $node["webhook-1791618803607002"]?.json?.body?.topic ||\n'
            "      ''\n"
            "    ).trim();\n"
            "  } catch (e) {}\n"
            "}\n\n"
            "return urls.map(url => ({\n"
            "  json: {\n"
            "    api_url: url,\n"
            "    request_topic: requestTopic,\n"
            "    request_topic_backup: requestTopic\n"
            "  }\n"
            "}));"
        )

    # 4. code.execute-1791371113051035 ("Extract Kaggle Files")
    elif nid == "code.execute-1791371113051035":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        inputs["code"] = (
            "const items = $input.all();\n\n"
            "const datasets = [];\n\n"
            "let requestTopic = '';\n\n"
            "for (const item of items) {\n"
            "  const data = item.json || {};\n\n"
            "  if (!requestTopic) {\n"
            "    requestTopic = String(\n"
            "      data.request_topic || data.request_topic_backup || ''\n"
            "    ).trim();\n"
            "  }\n\n"
            "  const body = data.body || {};\n"
            "  const datasetRef = String(\n"
            "    body.ref || body.refNullable || ''\n"
            "  ).trim();\n\n"
            "  if (!datasetRef) continue;\n\n"
            "  datasets.push({\n"
            "    platform: 'kaggle.com',\n"
            "    dataset_ref: datasetRef,\n"
            "    title: String(body.title || body.titleNullable || '').trim(),\n"
            "    source_url: `https://www.kaggle.com/datasets/${datasetRef}`,\n"
            "    download_url: `https://www.kaggle.com/api/v1/datasets/download/${datasetRef}`\n"
            "  });\n"
            "}\n\n"
            "if (!requestTopic) {\n"
            "  try {\n"
            "    requestTopic = String(\n"
            '      $node["code.execute-1791438368178001"]?.json?.request_topic ||\n'
            '      $node["code.execute-1791355811168006"]?.json?.request_topic ||\n'
            '      $node["webhook-1791618803607002"]?.json?.body?.topic ||\n'
            "      ''\n"
            "    ).trim();\n"
            "  } catch (e) {}\n"
            "}\n\n"
            "return [{\n"
            "  json: {\n"
            "    request_topic: requestTopic,\n"
            "    total_datasets: datasets.length,\n"
            "    datasets: datasets\n"
            "  }\n"
            "}];"
        )

    # 5. code.execute-1791371557952036 ("Extract Hugging Face Files")
    elif nid == "code.execute-1791371557952036":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        code_str = inputs.get("code", "")
        if "if (!requestTopic)" in code_str and 'code.execute-1791438368178001' not in code_str:
            inputs["code"] = code_str.replace(
                "return [\n  {\n    json: {\n      request_topic: requestTopic,",
                "if (!requestTopic) {\n  try {\n    requestTopic = String($node[\"code.execute-1791438368178001\"]?.json?.request_topic || $node[\"code.execute-1791355811168006\"]?.json?.request_topic || $node[\"webhook-1791618803607002\"]?.json?.body?.topic || \"\").trim();\n  } catch (e) {}\n}\nreturn [\n  {\n    json: {\n      request_topic: requestTopic,"
            )

    # 6. code.execute-1791373569323037 ("GitHub Extract")
    elif nid == "code.execute-1791373569323037":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        code_str = inputs.get("code", "")
        if "if (!requestTopic)" in code_str and 'code.execute-1791438368178001' not in code_str:
            inputs["code"] = code_str.replace(
                "return [\n  {\n    json: {\n      request_topic: requestTopic,",
                "if (!requestTopic) {\n  try {\n    requestTopic = String($node[\"code.execute-1791438368178001\"]?.json?.request_topic || $node[\"code.execute-1791355811168006\"]?.json?.request_topic || $node[\"webhook-1791618803607002\"]?.json?.body?.topic || \"\").trim();\n  } catch (e) {}\n}\nreturn [\n  {\n    json: {\n      request_topic: requestTopic,"
            )

    # 7. code.execute-1791429989428001 ("Zenodo Extract")
    elif nid == "code.execute-1791429989428001":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        code_str = inputs.get("code", "")
        if "if (!requestTopic)" in code_str and 'code.execute-1791438368178001' not in code_str:
            inputs["code"] = code_str.replace(
                "return [\n  {\n    json: {\n      request_topic: requestTopic,",
                "if (!requestTopic) {\n  try {\n    requestTopic = String($node[\"code.execute-1791438368178001\"]?.json?.request_topic || $node[\"code.execute-1791355811168006\"]?.json?.request_topic || $node[\"webhook-1791618803607002\"]?.json?.body?.topic || \"\").trim();\n  } catch (e) {}\n}\nreturn [\n  {\n    json: {\n      request_topic: requestTopic,"
            )

    # 8. code.execute-1791434825160005 ("Prepare Sheet Records")
    elif nid == "code.execute-1791434825160005":
        inputs = node.setdefault("data", {}).setdefault("inputs", {})
        code_str = inputs.get("code", "")
        if "if (!requestTopic)" in code_str and 'code.execute-1791438368178001' not in code_str:
            replacement = (
                "  if (!requestTopic) {\n"
                "    requestTopic = String(data.request_topic || data.request_topic_backup || '').trim();\n"
                "  }\n"
                "}\n"
                "if (!requestTopic) {\n"
                "  try {\n"
                "    requestTopic = String($node[\"code.execute-1791438368178001\"]?.json?.request_topic || $node[\"code.execute-1791355811168006\"]?.json?.request_topic || $node[\"webhook-1791618803607002\"]?.json?.body?.topic || \"\").trim();\n"
                "  } catch (e) {}\n"
                "}\n"
                "for (const file of files) {\n"
                "  if (!file.request_topic) file.request_topic = requestTopic;\n"
                "}\n"
            )
            inputs["code"] = code_str.replace("  if (!requestTopic) {\n    requestTopic = String(\n      data.request_topic || \"\"\n    ).trim();\n  }\n}", replacement)

    # 9. Postgres Insert Node 1: dataset_sources (Kaggle)
    elif nid == "postgres.insert-1791443857882007":
        cols = node.setdefault("data", {}).setdefault("inputs", {}).setdefault("columns", {})
        cols["request_topic"] = '{{$json["Request/Topic"] || $json.request_topic || $node["code.execute-1791434825160005"].json?.request_topic || $node["code.execute-1791355811168006"].json?.request_topic || $node["webhook-1791618803607002"].json.body?.topic || ""}}'

    # 10. Postgres Insert Node 2: dataset_sources_huggingface
    elif nid == "action-37d33a81-3717-4139-bd99-212a0c1beb5c":
        cols = node.setdefault("data", {}).setdefault("inputs", {}).setdefault("columns", {})
        cols["request_topic"] = '{{$node["core_loop-1791445204491012"].json["Request/Topic"] || $json["Request/Topic"] || $json.request_topic || $node["code.execute-1791434825160005"].json?.request_topic || $node["code.execute-1791355811168006"].json?.request_topic || $node["webhook-1791618803607002"].json.body?.topic || ""}}'

    # 11. Postgres Insert Node 3: github_dataset_sources
    elif nid == "action-9506dd3e-238a-41a8-b3a8-84a9ba854aa0":
        cols = node.setdefault("data", {}).setdefault("inputs", {}).setdefault("columns", {})
        cols["file_type"] = '{{$node["loop-5507e7ac-9b04-45d3-aab0-02c5a4e01ae0"].json["File Type"] || $json["File Type"] || ""}}'
        cols["request_topic"] = '{{$node["loop-5507e7ac-9b04-45d3-aab0-02c5a4e01ae0"].json["Request/Topic"] || $json["Request/Topic"] || $json.request_topic || $node["code.execute-1791434825160005"].json?.request_topic || $node["code.execute-1791355811168006"].json?.request_topic || $node["webhook-1791618803607002"].json.body?.topic || ""}}'

    # 12. Postgres Insert Node 4: zenodo_dataset_sources
    elif nid == "postgres.insert-1791450936983014":
        cols = node.setdefault("data", {}).setdefault("inputs", {}).setdefault("columns", {})
        cols["request_topic"] = '{{$node["loop-24e0a6ce-fe36-4a4b-a3f8-ca4632613c59"].json["Request/Topic"] || $json["Request/Topic"] || $json.request_topic || $node["code.execute-1791434825160005"].json?.request_topic || $node["code.execute-1791355811168006"].json?.request_topic || $node["webhook-1791618803607002"].json.body?.topic || ""}}'

with open(WORKFLOW_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2)

print("Successfully updated workflow JSON with all dynamic topic fixes!")
