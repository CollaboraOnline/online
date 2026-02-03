// -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-

using OpenQA.Selenium.Edge;
using OpenQA.Selenium.Support.UI;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Automation;

namespace WebDriverThing
{
    internal class Program
    {
        static void Main(string[] args)
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

            var openButton = driver.FindElement(OpenQA.Selenium.By.Id("backstage-open"));
            openButton.Click();

            // How long should we wait for the File Open dialog to appear? Let's try 5 s.
            Thread.Sleep(5000);

            var openDialog = AutomationElement.RootElement.FindFirst(
                TreeScope.Children,
                new PropertyCondition(AutomationElement.NameProperty, "Open")
            );

            var openDialogOpenButton = openDialog.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, "1")
            );

            var fileNameField = openDialog.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, "1148")
            );

            var valuePattern = (ValuePattern)fileNameField.GetCurrentPattern(ValuePattern.Pattern);
            valuePattern.SetValue(@"C:\Users\tml\sailing.odt");

            // This does not seem to work. Would love to figure out some bette, sane, and reliable
            // way to do this.
            // ((InvokePattern)openDialogOpenButton.GetCurrentPattern(InvokePattern.Pattern)).Invoke();

            // This works, and is mad and scary! Just pretend Enter is pressed to whatever window
            // that has the focus. This means that you have to be very careful when debugging this
            // code. You can't let VS have the focus when this line is executed.
            System.Windows.Forms.SendKeys.SendWait("{ENTER}");

            Thread.Sleep(20000);

            driver.Quit();
        }
    }
}
