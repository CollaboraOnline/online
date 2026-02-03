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
            eo.BinaryLocation = "C:\\Users\\tml\\bin\\msedgedriver.exe";

            EdgeDriver driver = new EdgeDriver(service, eo);
            driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(2);

            var openButton = driver.FindElement(OpenQA.Selenium.By.Id("backstage-open"));
            openButton.Click();

            var window = AutomationElement.RootElement.FindFirst(
                TreeScope.Children,
                new PropertyCondition(AutomationElement.NameProperty, "Open")
            );

            var okButton = window.FindFirst(
                TreeScope.Descendants,
                new PropertyCondition(AutomationElement.AutomationIdProperty, "1")
            );

            Thread.Sleep(20000);

            driver.Quit();
        }
    }
}
