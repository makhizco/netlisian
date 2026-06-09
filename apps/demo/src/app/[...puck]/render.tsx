"use client";
import { Config, Data, Render } from "@puckeditor/core";

const RenderPage = ({
  config,
  data,
  styles,
}: {
  config: Config;
  data: Partial<Data>;
  styles?: string;
}) => {
  return (
    <>
      {styles && (
        <style
          id="static-tailwind-styles"
          dangerouslySetInnerHTML={{ __html: styles }}
        />
      )}
      <Render data={data as Data} config={config} />
    </>
  );
};

export default RenderPage;
