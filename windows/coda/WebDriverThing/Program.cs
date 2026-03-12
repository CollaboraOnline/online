// -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-

using OpenQA.Selenium.Edge;
using OpenQA.Selenium.Interactions;
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Automation;
using System.Windows.Forms;
using System.Xml.Linq;
using Keys = OpenQA.Selenium.Keys;

namespace WebDriverThing
{
    internal class Program
    {
        static void fatal(string message)
        {
            throw new Exception(message);
        }

        static EdgeDriver connectToWebView2()
        {
            EdgeDriverService service = EdgeDriverService.CreateDefaultService();
            service.EnableVerboseLogging = true;

            EdgeOptions eo = new EdgeOptions();

            eo.UseWebView = true;
            eo.DebuggerAddress = "localhost:9222";
            // This file needs to exist but it can be totally random, even empty, huh?
            eo.BinaryLocation = @"C:\Users\tml\lo\online-coda25-coda\foobar.exe";

            EdgeDriver driver = new EdgeDriver(service, eo);
            driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(2);

            return driver;
        }

        static void FindAndClick(EdgeDriver driver, OpenQA.Selenium.By what)
        {
            var button = driver.FindElement(what);
            // The above line will throw an exception if the element is not found, so checking for
            // null is pointless.
            button.Click();
        }

        static void openFile(string pathname)
        {
            Thread.Sleep(1000);
            var driver = connectToWebView2();

            FindAndClick(driver, OpenQA.Selenium.By.Id("backstage-open"));

            // The File Open dialog is a native one so we need to use the System.Windows.Automation
            // API to manipulate it.

            // How long should we wait for the File Open dialog to appear? Let's try 5 s.
            Thread.Sleep(5000);

            var openDialog = AutomationElement.RootElement.FindFirst(
                TreeScope.Children,
                new PropertyCondition(AutomationElement.NameProperty, "Open")
            );

            if (openDialog == null)
                fatal("File Open dialog did not show up");

            var openDialogOpenButton = openDialog.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, "1")
            );

            if (openDialogOpenButton == null)
                fatal("No 'Open' button in the File Open dialog");

            var fileNameField = openDialog.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, "1148")
            );

            if (fileNameField == null)
                fatal("No file name field in the File Open dialog");

            var valuePattern = (ValuePattern)fileNameField.GetCurrentPattern(ValuePattern.Pattern);
            valuePattern.SetValue(pathname);

            // This does not seem to work. Would love to figure out some bette, sane, and reliable
            // way to do this.
            // ((InvokePattern)openDialogOpenButton.GetCurrentPattern(InvokePattern.Pattern)).Invoke();

            // This works, and is mad and scary! Just pretend Enter is pressed to whatever window
            // that has the focus. This means that you have to be very careful when debugging this
            // code. You can't let VS have the focus when this line is executed.
            System.Windows.Forms.SendKeys.SendWait("{ENTER}");
        }

        static void RunOnSTA(Action action)
        {
            Exception ex = null;
            var t = new Thread(() => {
                try { action(); }
                catch (Exception e) { ex = e; }
            });
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
            t.Join();
            if (ex != null) throw ex;
        }

        static async Task Main(string[] args)
        {
            // Make a copy of an empty .otd. Assume we are running in <top>\windows\coda\WebDriverThing\bin\Debug.
            var topDir = Path.GetFullPath(AppContext.BaseDirectory + @"\..\..\..\..\..");

            // Find out the --with-app-name value from config.status
            var regex = new Regex("S\\[\"APP_NAME\"\\]=\"([^\"]+)\"$");
            var match = File.ReadLines(topDir + @"\config.status")
                .Select(l => regex.Match(l))
                .FirstOrDefault(m => m.Success);

            string appName = match?.Groups[1].Value.Trim();

            if (appName == null)
                fatal("No APP_NAME in config.status");

            var platform = (RuntimeInformation.OSArchitecture == Architecture.X64 ? "x64" : "ARM64");
            const string configuration =
#if DEBUG
                "Debug"
#else
                "Release"
#endif
            ;
            var codaExe = topDir + @"\windows\coda\" + platform + @"\" + configuration + @"\program\" + appName + ".exe";
            var coda = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = codaExe,
                    UseShellExecute = false
                }
            };

            coda.StartInfo.Environment["CODA_ENABLE_WEBDRIVER"] = "YES";

            coda.Start();

            var docCopy = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.odt");

            File.Copy(topDir + @"\browser\templates\TextDocument.odt", docCopy, true);

            // Use the Open button to load it
            openFile(docCopy);

            // Then do some simple things with it

            var driver = connectToWebView2();

            // Paste text from clipboard with shortcut
            RunOnSTA(() => Clipboard.SetText("hello"));
            Thread.Sleep(500);
            new Actions(driver).KeyDown(Keys.Control).SendKeys("v").KeyUp(Keys.Control).Perform();

            Thread.Sleep(500);
            new Actions(driver).SendKeys(Keys.Enter).Perform();

            RunOnSTA(() => Clipboard.SetText("tööt"));
            Thread.Sleep(500);
            new Actions(driver).KeyDown(Keys.Control).SendKeys("v").KeyUp(Keys.Control).Perform();

            Thread.Sleep(500);
            new Actions(driver).SendKeys(Keys.Enter).Perform();

            Thread.Sleep(500);
            new Actions(driver).SendKeys("Third paragraph").Perform();

            // Next paste an image into the document
            byte[] imageData = File.ReadAllBytes(topDir + @"\cypress_test\data\desktop\writer\image_to_insert.png");
            RunOnSTA(() => Clipboard.SetData("PNG", new MemoryStream(imageData)));
            Thread.Sleep(500);
            new Actions(driver).KeyDown(Keys.Control).SendKeys("v").KeyUp(Keys.Control).Perform();

            // Use the "backstage"
            FindAndClick(driver, OpenQA.Selenium.By.Id("File-tab-label"));

            FindAndClick(driver, OpenQA.Selenium.By.Id("backstage-info"));

            FindAndClick(driver, OpenQA.Selenium.By.ClassName("backstage-property-button"));

            FindAndClick(driver, OpenQA.Selenium.By.Id("cancel-button"));

            FindAndClick(driver, OpenQA.Selenium.By.Id("File-tab-label"));
            Thread.Sleep(500);
            FindAndClick(driver, OpenQA.Selenium.By.ClassName("backstage-sidebar-back"));

            // Save the document
            Thread.Sleep(500);
            new Actions(driver).KeyDown(Keys.Control).SendKeys("s").KeyUp(Keys.Control).Perform();

            // Close the document (and app) using Control+W
            Thread.Sleep(500);
            new Actions(driver).KeyDown(Keys.Control).SendKeys("w").KeyUp(Keys.Control).Perform();

            Thread.Sleep(500);
            driver.Quit();

            coda.WaitForExit();

            // Open the edited document and verify we edited it as expected
            var stream = File.OpenRead(docCopy);
            var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            var contentStream = archive.GetEntry("content.xml").Open();
            var ms = new MemoryStream();
            contentStream.CopyTo(ms);

            byte[] content = ms.ToArray();
            var s = Encoding.UTF8.GetString(content);

            var doc = XDocument.Parse(s);
            XNamespace office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
            XNamespace text = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
            XNamespace draw = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0";
            XNamespace xlink = "http://www.w3.org/1999/xlink";
            var paragraphs = doc.Descendants(text + "p");
            if (paragraphs.Count() != 3)
                fatal("Unexpected number of paragraphs: " + paragraphs.Count());
            if (paragraphs.ElementAt(0).Value != "Hello")
                fatal("Unexpected paragraph 0");
            if (paragraphs.ElementAt(1).Value != "tööt")
                fatal("Unexpected paragraph 1");
            if (paragraphs.ElementAt(2).Value != "Third paragraph")
                fatal("Unexpected paragraph 2");

            var images = doc.Descendants(draw + "image");
            if (images.Count() != 1)
                fatal("Unexpected number of images: " + images.Count());

            var imagePath = images.ElementAt(0).Attribute(xlink + "href").Value;
            var imageStream = archive.GetEntry(imagePath).Open();
            byte[] documentImageData;
            ms = new MemoryStream();
            imageStream.CopyTo(ms);
            documentImageData = ms.ToArray();
#if false
            // It seems that pasting a PNG changes at least its metadata, go figure. So don't bother
            // attempting to verify that it is the same image.
            etc...
#endif
            stream.Close();
            File.Delete(docCopy);

            Console.WriteLine("OK");
        }
    }
}
