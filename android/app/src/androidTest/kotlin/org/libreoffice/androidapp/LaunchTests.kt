package org.libreoffice.androidapp

import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.libreoffice.androidapp.ui.LibreOfficeUIActivity

@RunWith(AndroidJUnit4::class)
class LaunchTests {
    @get:Rule
    val activityRule = ActivityScenarioRule(LibreOfficeUIActivity::class.java)

    @Test
    fun testLaunch() {
        onView(withId(R.id.action_open_file)).check(matches(isDisplayed()))
    }
}
