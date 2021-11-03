#!/usr/bin/env python

from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib import parse
from urllib.request import *

import argparse
import re
import json
import os
import requests
import xml.etree.ElementTree as ET
import base64

# Configuration
coolServerUrl = "http://localhost:9980"
solrServerUrl = "http://localhost:8983"

documentPath = "Docs/"
coolInstance = coolServerUrl + "/browser/f6d368a0a/cool.html"
solrCollectionName = "documents"

# Templates

solrSelectUrl = "{}/solr/{}/select".format(solrServerUrl, solrCollectionName)
solrUpdateUrl = "{}/solr/{}/update?commit=true".format(solrServerUrl, solrCollectionName)

# Transform the LO indexing XML structure to Solr structure
def transformToSolrFormat(xmlContent, filename):
    root = ET.fromstring(xmlContent)
    builder = ET.TreeBuilder()
    builder.start("add", {})

    for entry in root:
        if entry.tag == 'paragraph' or entry.tag == 'object':
            builder.start("doc", {})

            builder.start("field", {"name" : "filename"})
            builder.data(filename)
            builder.end("filed")

            builder.start("field", {"name" : "type"})
            builder.data(entry.tag)
            builder.end("field")

            for attribute in entry.attrib:
                builder.start("field", {"name" : attribute})
                builder.data(entry.attrib[attribute])
                builder.end("field")

            builder.start("field", {"name" : "content"})
            builder.data(entry.text)
            builder.end("field")

            builder.end("doc")
    builder.end("add")

    et = ET.ElementTree(builder.close())
    ET.indent(et, space="  ", level=0)
    return ET.tostring(et.getroot(), encoding='utf-8', xml_declaration=True)

# Create Solr XML to remove all entries from the database
def createSolrDeleteXml():
    builder = ET.TreeBuilder()
    builder.start("update", {})
    builder.start("delete", {})
    builder.start("query", {})
    builder.data("*:*")
    builder.end("query")
    builder.end("delete")
    builder.end("update")

    et = ET.ElementTree(builder.close())
    ET.indent(et, space="  ", level=0)
    return ET.tostring(et.getroot(), encoding='utf-8', xml_declaration=True)

# Calls "Convert To - Indexing XML" service on COOL Server
def callConvertToIndexingXml(filename, filepath):
    filesDict = {
        'data': (filepath, open(filepath, 'rb'), None, {})
    }
    response = requests.post("{}/lool/convert-to/xml".format(coolServerUrl), files=filesDict)
    if response.ok:
        return response.content
    return None

# Reindex all documents
def runReindexProcess():
    headers = {'Content-Type' : 'text/xml'}

    # remove existing entries from the database
    requests.post(solrUpdateUrl, data=createSolrDeleteXml(), headers=headers)

    # add the new indices into SOLR server
    for document in getDocuments():
        filename = document['name']
        xmlContent = callConvertToIndexingXml(filename, documentPath + filename)
        if xmlContent:
            # add indexing XML values
            headers = {'Content-Type' : 'text/xml'}
            solrTransformed = transformToSolrFormat(xmlContent, filename)
            response = requests.post(solrUpdateUrl, data=solrTransformed, headers=headers)
            if not response.ok:
                return False
    return True

# Search/Query on Solr
def callQueryServiceOnSolr(jsonString):
    searchStructure = json.loads(jsonString)
    query = searchStructure['query']

    response = requests.get("{}?rows=50&q=content:{}".format(solrSelectUrl, query))
    result = response.json()
    responseBody = result['response']
    if responseBody['numFound'] > 0:
        for document in responseBody['docs']:
            type = document['type'][0]
            filename = document['filename'][0]
            href = "{}?file_path=file://{}".format(coolInstance, os.path.abspath(documentPath + filename))
            if type == "paragraph":
                returnMap = {
                    'filename' : filename,
                    'href' : href,
                    'type' : document['type'][0],
                    'index' : document['index'][0],
                    'node_type' : document['node_type'][0],
                    'content' : document['content'][0]
                }
                if 'object_name' in document:
                    returnMap['object_name'] = document['object_name'][0]
                yield returnMap

# Gets all the available documents contained in the document path
def getDocuments():
    with os.scandir(documentPath) as entries:
        for entry in entries:
            if entry.is_file():
                yield {
                    "name" : entry.name,
                    "href" : "{}?file_path=file://{}".format(coolInstance, os.path.abspath(documentPath + entry.name))
                }

# Calls "Render Search Result" service on COOL Server
# Input is search result and the document, and return the rendered image
def callRenderImageService(resultJsonString):
    result = json.loads(resultJsonString)
    filename = result['filename']
    # Enclose json with [] - as the server supports more search results, which are then combined
    resultJsonProcessed = '[ ' + resultJsonString.decode('utf-8') + ' ]'
    filesDict = {
        "document": (filename, open(documentPath + filename, 'rb'), None, {}),
        "result" : ("json", resultJsonProcessed, None, {})
    }
    response = requests.post("{}/lool/render-search-result".format(coolServerUrl), files=filesDict)
    return base64.b64encode(response.content)

# HTTP Server - Handle HTTP requests
class HTTPRequestHandler(SimpleHTTPRequestHandler):
    def handleImageRequest(self):
        jsonString = self.rfile.read(int(self.headers['Content-Length']))
        imageBase64 = callRenderImageService(jsonString)
        if imageBase64:
            self.send_response(200)
        else:
            self.send_response(403)
        self.end_headers()
        if imageBase64:
            self.wfile.write(imageBase64)

    def handleReindexRequest(self):
        if runReindexProcess():
            self.send_response(200)
        else:
            self.send_response(403)
        self.end_headers()

    def handleSearchRequest(self):
        jsonString = self.rfile.read(int(self.headers['Content-Length']))
        searchResult = [i for i in callQueryServiceOnSolr(jsonString)]
        if searchResult:
            self.send_response(200)
        else:
            self.send_response(403)
        self.end_headers()

        if searchResult:
            data = json.dumps(searchResult)
            self.wfile.write(data.encode('utf8'))

    def handleDocumentsRequest(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        data = json.dumps([i for i in getDocuments()])
        self.wfile.write(data.encode('utf8'))

    def do_POST(self):
        if re.search('/search', self.path):
            self.handleSearchRequest()
        elif re.search('/reindex', self.path):
            self.handleReindexRequest()
        elif re.search('/image', self.path):
            self.handleImageRequest()
        else:
            self.send_response(403)
            self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.path = '/Main.html'
        elif re.search('/documents', self.path):
            self.handleDocumentsRequest()
        else:
            return SimpleHTTPRequestHandler.do_GET(self)

#run with "python Server.py 8000 127.0.0.1"

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='HTTP Server')
    parser.add_argument('port', type=int, default=8000, help='Listening port for HTTP Server')
    parser.add_argument('ip', default="127.0.0.1", help='HTTP Server IP')
    args = parser.parse_args()

    server = HTTPServer((args.ip, args.port), HTTPRequestHandler)
    print('HTTP Server Running...........')
    server.serve_forever()
