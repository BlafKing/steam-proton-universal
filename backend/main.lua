local logger = require("logger")
local millennium = require("millennium")
local fs = require("fs")
local json = require("json")

-- Helper function to create JSON response
local function json_response(success, message, extra_fields)
    local response = {
        success = success,
        message = message
    }
    
    if extra_fields then
        for k, v in pairs(extra_fields) do
            response[k] = v
        end
    end
    
    return json.encode(response)
end

-- Function callable from frontend to create symlinks
-- Frontend passes object with {app_id, compatdata_path, proton_prefix_path}
-- Lua receives them unpacked in alphabetical order: app_id, compatdata_path, proton_prefix_path
function create_symlinks(app_id, compatdata_path, proton_prefix_path)
    local success, result = pcall(function()
        logger:info("Creating symlinks for app " .. tostring(app_id))
    
    -- Validate that protonPrefixPath is configured
    if not proton_prefix_path or proton_prefix_path == "" then
        return json_response(false, "No protonPrefixPath configured")
    end
    
    -- Validate paths exist
    if not fs.exists(proton_prefix_path) then
        return json_response(false, "Proton prefix path does not exist: " .. proton_prefix_path)
    end
    
    if not fs.is_directory(proton_prefix_path) then
        return json_response(false, "Proton prefix path is not a directory: " .. proton_prefix_path)
    end
    
    local files_copied = 0
    
    -- Check if compatdata folder exists and if it's already a symlink to our universal prefix
    if fs.exists(compatdata_path) or fs.is_symlink(compatdata_path) then
        -- Check if it's already a symlink pointing to our universal prefix
        if fs.is_symlink(compatdata_path) then
            -- Read the symlink target using readlink command
            local cmd = string.format('readlink "%s"', compatdata_path)
            local handle = io.popen(cmd)
            if not handle then
                return json_response(false, "Failed to read symlink target")
            end
            local link_target = handle:read("*a")
            handle:close()
            
            if link_target then
                link_target = link_target:gsub("\n$", "") -- Remove trailing newline
                
                -- Make both paths absolute for comparison
                local abs_target
                if link_target:sub(1, 1) == "/" then
                    abs_target = link_target
                else
                    abs_target = fs.join(fs.parent(compatdata_path), link_target)
                end
                
                local abs_proton
                if proton_prefix_path:sub(1, 1) == "/" then
                    abs_proton = proton_prefix_path
                else
                    abs_proton = fs.absolute(proton_prefix_path)
                end
                
                if abs_target == abs_proton then
                    logger:info("Compatdata folder for app " .. app_id .. " is already a symlink to universal prefix, skipping...")
                    return json_response(true, "Symlink already exists", {symlinkCount = 1, filesCopied = 0})
                end
            end
            
            -- Symlink exists but points somewhere else - remove it
            logger:info("Removing incompatible symlink: " .. compatdata_path)
            local ok, remove_err = fs.remove(compatdata_path)
            if not ok then
                return json_response(false, "Failed to remove incompatible symlink: " .. (remove_err or "unknown error"))
            end
        
        -- If it's a real directory with content, copy the content first
        elseif fs.is_directory(compatdata_path) then
            local contents, list_err = fs.list(compatdata_path)
            if contents and #contents > 0 then
                logger:info("Compatdata folder for app " .. app_id .. " has existing content, copying to universal prefix...")
                
                -- Copy existing files from compatdata to universal prefix
                for _, item in ipairs(contents) do
                    local source_item_path = item.path
                    local dest_item_path = fs.join(proton_prefix_path, item.name)
                    
                    -- Skip if destination already exists (don't overwrite)
                    if fs.exists(dest_item_path) then
                        logger:info("Destination already exists, skipping copy: " .. dest_item_path)
                    else
                        local copy_ok, copy_err
                        if item.is_directory then
                            -- Copy directory recursively
                            copy_ok, copy_err = fs.copy_recursive(source_item_path, dest_item_path, false)
                            if copy_ok then
                                logger:info("Copied directory: " .. source_item_path .. " -> " .. dest_item_path)
                                files_copied = files_copied + 1
                            else
                                logger:error("Failed to copy directory " .. source_item_path .. ": " .. (copy_err or "unknown error"))
                            end
                        else
                            -- Copy file
                            copy_ok, copy_err = fs.copy(source_item_path, dest_item_path, false)
                            if copy_ok then
                                logger:info("Copied file: " .. source_item_path .. " -> " .. dest_item_path)
                                files_copied = files_copied + 1
                            else
                                logger:error("Failed to copy file " .. source_item_path .. ": " .. (copy_err or "unknown error"))
                            end
                        end
                    end
                end
            end
            
            -- Remove the compatdata folder after copying
            local remove_count, remove_err = fs.remove_all(compatdata_path)
            if not remove_count then
                logger:error("Failed to remove compatdata folder: " .. (remove_err or "unknown error"))
                return json_response(false, "Failed to remove compatdata folder after copying: " .. (remove_err or "unknown error"))
            end
            logger:info("Removed compatdata folder: " .. compatdata_path)
        end
    end
    
    -- Create a symlink from the compatdata path directly to the universal prefix
    local cmd = string.format('ln -s "%s" "%s"', proton_prefix_path, compatdata_path)
    local exec_result = os.execute(cmd)
    
    if exec_result == 0 or exec_result == true then
        logger:info("Created symlink: " .. compatdata_path .. " -> " .. proton_prefix_path)
        
        local result_message = "Created symlink to universal prefix"
        if files_copied > 0 then
            result_message = result_message .. ", copied " .. files_copied .. " items from existing compatdata"
        end
        
        logger:info("Successfully completed symlink creation for app " .. app_id .. ": " .. result_message)
        return json_response(true, result_message, {symlinkCount = 1, filesCopied = files_copied})
    else
        local error_msg = "Failed to create symlink " .. compatdata_path .. " -> " .. proton_prefix_path
        logger:error(error_msg)
        return json_response(false, error_msg)
    end
    end)
    
    if not success then
        logger:error("Error in create_symlinks: " .. tostring(result))
        return json_response(false, "Backend error: " .. tostring(result))
    end
    
    return result
end

local function on_load()
    local success, err = pcall(function()
        logger:info("Proton Universal Prefix backend loaded")
        millennium.ready()
    end)
    
    if not success then
        logger:error("Error during plugin load: " .. tostring(err))
        -- Still call ready so Millennium doesn't wait for timeout
        millennium.ready()
    end
end

local function on_unload()
    logger:info("Proton Universal Prefix backend unloaded")
end

local function on_frontend_loaded()
    logger:info("Frontend loaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    on_frontend_loaded = on_frontend_loaded
}
