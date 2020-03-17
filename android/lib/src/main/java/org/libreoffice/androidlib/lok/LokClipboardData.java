package org.libreoffice.androidlib.lok;

import android.util.Base64;
import android.util.JsonReader;
import android.util.JsonWriter;

import java.io.Serializable;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class LokClipboardData implements Serializable {
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
            FileOutputStream fileStream = new FileOutputStream(file.getAbsoluteFile());
	    ObjectOutputStream oos = new ObjectOutputStream(fileStream);
	    oos.writeObject(this);
	    oos.close();
	    fileStream.close();
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
        return true;
    }

    public static LokClipboardData createFromFile(File file) {
        try {
            FileInputStream fileStream = new FileInputStream(file.getAbsoluteFile());
	    ObjectInputStream ois = new ObjectInputStream(fileStream);
	    LokClipboardData data = (LokClipboardData)ois.readObject();
	    ois.close();
	    fileStream.close();
	    return data;
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
            return null;
        }
    }

    public LokClipboardEntry getBest() {
        if (!clipboardEntries.isEmpty()) {
            return clipboardEntries.get(0);
        }
        return null;
    }
}

