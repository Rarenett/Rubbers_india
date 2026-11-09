import React from "react";
import "react-dropzone-uploader/dist/styles.css";
import Drop from "react-dropzone-uploader";

const DropFile = ({ onFilesChange }) => {
   const handleChangeStatus = ({ meta, file }, status, allFiles) => {
      if (onFilesChange) {
         const activeFiles = allFiles
            .filter(f => f.meta.status !== 'rejected')
            .map(f => f.file);
         onFilesChange(activeFiles);
      }
   };

   return (
      <Drop
         onChangeStatus={handleChangeStatus}
         inputContent="Drop files here to upload"
         accept="*"
         styles={{
            dropzone: {
               minHeight: 150,
               maxHeight: 250,
               width: "100%",
               backgroundColor: "#f2f4fa",
               border: "1px dashed #DDDFE1",
               overflow: "hidden",
            },
            inputLabel: {
               color: "#7e7e7e",
               fontSize: "18px",
               fontWeight: "normal",
               backgroundColor: "#f2f4fa",
            },
         }}
      />
   );
};

export default DropFile;
