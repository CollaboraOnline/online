// -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-

using OpenQA.Selenium.Edge;
using System;
using System.Threading;
using System.Windows.Automation;

namespace WebDriverThing
{
    internal class Program
    {
        static void fatal(string message)
        {
            Console.WriteLine(message);
            System.Environment.Exit(1);
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

        static void openFile(string pathname)
        {
            var driver = connectToWebView2();

            var openButton = driver.FindElement(OpenQA.Selenium.By.Id("backstage-open"));
            if (openButton == null)
                fatal("Could not find the 'Open' button on the initial backstage");

            openButton.Click();

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

        static void Main(string[] args)
        {
            // Use the Open button to load a document.
            openFile(@"C:\Users\tml\sailing.odt");

            var driver = connectToWebView2();

            // At first, click the button to enable editing.
            // Give for the document time to load.
            var editButton = driver.FindElement(OpenQA.Selenium.By.Id("mobile-edit-button"));

            if (editButton == null)
                fatal("No mobile-edit-button");

            Thread.Sleep(5000);
            editButton.Click();

            Thread.Sleep(20000);

            driver.Quit();
        }
    }
}
