// -*- Mode: ObjC; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*-
//
// This file is part of the LibreOffice project.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#import "TemplateCollectionViewController.h"
#import "TemplateSectionHeaderView.h"

@implementation TemplateCollectionViewController

-(void)viewDidLoad {

    // Here we should scan for available templates.

    templates[0] = [[NSBundle mainBundle] URLsForResourcesWithExtension:@".ott" subdirectory:@"Templates"];
    templates[1] = [[NSBundle mainBundle] URLsForResourcesWithExtension:@".ots" subdirectory:@"Templates"];
    templates[2] = [[NSBundle mainBundle] URLsForResourcesWithExtension:@".otp" subdirectory:@"Templates"];
}

- (NSInteger)numberOfSectionsInCollectionView:(UICollectionView *)collectionView {
    // Three sections: Document, Spreadsheet, and Presentation
    return 3;
}

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section {
    assert(section >= 0 && section <= 2);
    return templates[section].count;
}

- (UICollectionViewCell *)collectionView:(UICollectionView *)collectionView cellForItemAtIndexPath:(NSIndexPath *)indexPath {
    assert(indexPath.length == 2);
    assert([indexPath indexAtPosition:0] <= 2);
    assert([indexPath indexAtPosition:1] < templates[[indexPath indexAtPosition:0]].count);

    UICollectionViewCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:@"Cell" forIndexPath:indexPath];

    UIImageView *image = (UIImageView *)[cell viewWithTag:1];
    UILabel *title = (UILabel *)[cell viewWithTag:2];

    // FIXME: Just use a dummy image for now
    image.image = [UIImage imageNamed:@"AppIcon"];

    NSString *fileName = [templates[[indexPath indexAtPosition:0]][[indexPath indexAtPosition:1]] lastPathComponent];

    title.text = [fileName stringByDeletingPathExtension];

    return cell;
}

- (CGSize)collectionView:(UICollectionView *)collectionView layout:(UICollectionViewLayout*)collectionViewLayout sizeForItemAtIndexPath:(NSIndexPath *)indexPath {
    return CGSizeMake(150, 150);
}

- (UICollectionReusableView *)collectionView:(UICollectionView *)collectionView viewForSupplementaryElementOfKind:(NSString *)kind atIndexPath:(NSIndexPath *)indexPath {
    assert(kind == UICollectionElementKindSectionHeader);

    assert(indexPath.length == 2);
    assert([indexPath indexAtPosition:1] == 0);

    NSUInteger index = [indexPath indexAtPosition:0];
    assert(index <= 2);

    TemplateSectionHeaderView *header = [collectionView dequeueReusableSupplementaryViewOfKind:UICollectionElementKindSectionHeader withReuseIdentifier:@"SectionHeaderView" forIndexPath:indexPath];

    if (index == 0)
        header.title.text = @"Document";
    else if (index == 1)
        header.title.text = @"Spreadsheet";
    else if (index == 2)
        header.title.text = @"Presentation";

    return header;
}

@end

// vim:set shiftwidth=4 softtabstop=4 expandtab:
