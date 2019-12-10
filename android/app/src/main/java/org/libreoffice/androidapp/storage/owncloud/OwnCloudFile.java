package org.libreoffice.androidapp.storage.owncloud;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileFilter;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.libreoffice.androidapp.storage.IFile;

import com.owncloud.android.lib.common.operations.RemoteOperationResult;
import com.owncloud.android.lib.resources.files.ChunkedFileUploadRemoteOperation;
import com.owncloud.android.lib.resources.files.DownloadFileRemoteOperation;
import com.owncloud.android.lib.resources.files.ReadFolderRemoteOperation;
import com.owncloud.android.lib.resources.files.model.RemoteFile;
import com.owncloud.android.lib.resources.files.UploadFileRemoteOperation;
import com.owncloud.android.lib.resources.files.model.RemoteFile;

/**
 * Implementation of IFile for ownCloud servers.
 */
public class OwnCloudFile implements IFile {
    final static String LOGTAG = "OwnCloudFile";

    private OwnCloudProvider provider;
    private RemoteFile file;

    /** We create the document just once, cache it for further returning. */
    private File mCachedFile;

    private String name;
    private String parentPath;

    protected OwnCloudFile(OwnCloudProvider provider, RemoteFile file) {
        this.provider = provider;
        this.file = file;

        // get name and parent from path
        File localFile = new File(file.getRemotePath());
        this.name = localFile.getName();
        this.parentPath = localFile.getParent();
    }

    @Override
    public URI getUri(){

        try{
            return URI.create(URLEncoder.encode(file.getRemotePath(),"UTF-8"));
        }catch(UnsupportedEncodingException e){
            e.printStackTrace();
        }

        return null;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public boolean isDirectory() {
        return file.getMimeType().equals("DIR");
    }

    @Override
    public long getSize() {
        return file.getLength();
    }

    @Override
    public Date getLastModified() {
        return new Date(file.getModifiedTimestamp());
    }

    @Override
    public List<IFile> listFiles() {
        List<IFile> children = new ArrayList<IFile>();
        if (isDirectory()) {
            ReadFolderRemoteOperation refreshOperation = new ReadFolderRemoteOperation(
                    file.getRemotePath());
            RemoteOperationResult result = refreshOperation.execute(provider
                    .getClient());
            if (!result.isSuccess()) {
                throw provider.buildRuntimeExceptionForResultCode(result.getCode());
            }
            for (Object obj : result.getData()) {
                RemoteFile child = (RemoteFile) obj;
                if (!child.getRemotePath().equals(file.getRemotePath()))
                    children.add(new OwnCloudFile(provider, child));
            }
        }
        return children;
    }

    @Override
    public List<IFile> listFiles(FileFilter filter) {
        List<IFile> children = new ArrayList<IFile>();
        if (isDirectory()) {
            ReadFolderRemoteOperation refreshOperation = new ReadFolderRemoteOperation(
                    file.getRemotePath());
            RemoteOperationResult result = refreshOperation.execute(provider
                    .getClient());
            if (!result.isSuccess()) {
                throw provider.buildRuntimeExceptionForResultCode(result.getCode());
            }

            for (Object obj : result.getData()) {
                RemoteFile child = (RemoteFile) obj;
                if (!child.getRemotePath().equals(file.getRemotePath())){
                    OwnCloudFile ownCloudFile = new OwnCloudFile(provider, child);
                    if(!ownCloudFile.isDirectory()){
                        File f = new File(provider.getCacheDir().getAbsolutePath(),
                                ownCloudFile.getName());
                        if(filter.accept(f))
                            children.add(ownCloudFile);
                        f.delete();
                    }else{
                        children.add(ownCloudFile);
                    }
                }
            }
        }
        return children;
    }

    @Override
    public IFile getParent(Context context) {
        if (parentPath == null)
            // this is the root node
            return null;

        return provider.createFromUri(context, URI.create(parentPath));
    }

    @Override
    public File getDocument() {
        if (mCachedFile != null)
            return mCachedFile;

        if (isDirectory())
            return null;

        File downFolder = provider.getCacheDir();
        DownloadFileRemoteOperation operation = new DownloadFileRemoteOperation(
                file.getRemotePath(), downFolder.getAbsolutePath());
        RemoteOperationResult result = operation.execute(provider.getClient());
        if (!result.isSuccess()) {
            throw provider.buildRuntimeExceptionForResultCode(result.getCode());
        }

        mCachedFile = new File(downFolder.getAbsolutePath() + file.getRemotePath());
        return mCachedFile;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object)
            return true;
        if (!(object instanceof OwnCloudFile))
            return false;
        OwnCloudFile file = (OwnCloudFile) object;
        return file.getUri().equals(getUri());
    }

    @Override
    public void saveDocument() {
        if (mCachedFile == null) {
            Log.e(LOGTAG, "Trying to save document that was not created via getDocument()(");
            return;
        }

        UploadFileRemoteOperation uploadOperation;
        if (mCachedFile.length() > ChunkedFileUploadRemoteOperation.CHUNK_SIZE_MOBILE) {
            uploadOperation = new ChunkedFileUploadRemoteOperation(
                    mCachedFile.getPath(), file.getRemotePath(), file.getMimeType(), file.getEtag(), String.valueOf(mCachedFile.lastModified()), false /* TODO actually check if on Wifi */);
        } else {
            uploadOperation = new UploadFileRemoteOperation(mCachedFile.getPath(),
                    file.getRemotePath(), file.getMimeType(), String.valueOf(mCachedFile.lastModified()));
        }

        RemoteOperationResult result = uploadOperation.execute(provider
                .getClient());
        if (!result.isSuccess()) {
            throw provider.buildRuntimeExceptionForResultCode(result.getCode());
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
