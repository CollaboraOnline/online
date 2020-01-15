package org.libreoffice.androidlib.lok;

import android.util.Base64;
import android.util.JsonReader;
import android.util.JsonWriter;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class LokClipboardData {
    public ArrayList<LokClipboardEntry> clipboardEntries = new ArrayList<LokClipboardEntry>();

    public String getText() {
        for (LokClipboardEntry aEntry : clipboardEntries) {
            if (aEntry.mime.startsWith("text/plain")) { // text/plain;charset=utf-8
                return new String(aEntry.data, StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    public String getHtml() {
        for (LokClipboardEntry aEntry : clipboardEntries) {
            if (aEntry.mime.startsWith("text/html")){
                return new String(aEntry.data, StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    public boolean writeToFile(File file) {
        try {
            FileWriter fileWriter = new FileWriter(file.getAbsoluteFile());
            JsonWriter writer = new JsonWriter(fileWriter);
            writer.setIndent(" ");
            writer.beginObject();
            for (LokClipboardEntry entry : clipboardEntries) {
                writer.name(entry.mime);
                writer.value(Base64.encodeToString(entry.data, Base64.DEFAULT));
            }
            writer.endObject();
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
        return true;
    }

    public boolean loadFromFile(File file) {
        try {
            clipboardEntries.clear();

            FileReader fileReader= new FileReader(file.getAbsoluteFile());
            JsonReader reader = new JsonReader(fileReader);
            reader.beginObject();
            while (reader.hasNext()) {
                LokClipboardEntry entry = new LokClipboardEntry();
                entry.mime = reader.nextName();
                entry.data = Base64.decode(reader.nextString(), Base64.DEFAULT);
                clipboardEntries.add(entry);
            }
            reader.endObject();
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
        return true;
    }

    public LokClipboardEntry getBest() {
        if (!clipboardEntries.isEmpty()) {
            return clipboardEntries.get(0);
        }
        return null;
    }
}

