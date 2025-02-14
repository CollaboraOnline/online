#include <memory>

class CheckFileInfo
{
};

int main() {
    {
        // expected-error@+1 {{instance allocated on the stack, create it with std::shared_ptr [coplugin:refcounting]}}
        CheckFileInfo checkFileInfo;
    }

    {
        // good
        auto checkFileInfo = std::make_shared<CheckFileInfo>();
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
